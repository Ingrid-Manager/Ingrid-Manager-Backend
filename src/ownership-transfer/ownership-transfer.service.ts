import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { SeriesEvent } from '../series-events/infrastructure/relational/persistence/entities/series-event.entity';
import { CalendarEvent } from '../calendar-events/infrastructure/relational/persistence/entities/calendar-event.entity';
import { UsersService } from '../users/users.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditAction } from '../audit-log/audit-action.enum';
import { AuditEntityType } from '../audit-log/audit-entity-type.enum';
import { AuditService } from '../audit-log/audit-service.enum';
import { TransferOwnerDto } from './dto/transfer-owner.dto';

interface ActingUser {
  id: number;
}

@Injectable()
export class OwnershipTransferService {
  constructor(
    @InjectRepository(SeriesEvent)
    private readonly seriesRepo: Repository<SeriesEvent>,
    @InjectRepository(CalendarEvent)
    private readonly calendarRepo: Repository<CalendarEvent>,
    private readonly usersService: UsersService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async transfer(dto: TransferOwnerDto, actingUser: ActingUser) {
    const hasSeries = dto.seriesId !== undefined && dto.seriesId !== null;
    const hasEvent =
      dto.calendarEventId !== undefined && dto.calendarEventId !== null;

    if (hasSeries === hasEvent) {
      throw new BadRequestException(
        'Bitte genau eines von seriesId oder calendarEventId angeben.',
      );
    }

    const newOwner = await this.usersService.findById(dto.newOwnerId);
    if (!newOwner) {
      throw new NotFoundException(
        `Nutzer #${dto.newOwnerId} wurde nicht gefunden.`,
      );
    }

    const actingLabel = await this.auditLogService.getUserLabel({
      id: actingUser.id,
    });
    const newOwnerLabel = await this.auditLogService.getUserLabel({
      id: Number(newOwner.id),
      email: newOwner.email,
      firstName: newOwner.firstName,
      lastName: newOwner.lastName,
    });

    if (hasSeries) {
      return this.transferSeries(
        dto.seriesId!,
        Number(newOwner.id),
        actingUser,
        actingLabel,
        newOwnerLabel,
      );
    }

    return this.transferCalendarEvent(
      dto.calendarEventId!,
      Number(newOwner.id),
      actingUser,
      actingLabel,
      newOwnerLabel,
    );
  }

  private async transferSeries(
    seriesId: number,
    newOwnerId: number,
    actingUser: ActingUser,
    actingLabel: string,
    newOwnerLabel: string,
  ) {
    const series = await this.seriesRepo.findOne({ where: { id: seriesId } });
    if (!series) {
      throw new NotFoundException(
        `Serientermin #${seriesId} wurde nicht gefunden.`,
      );
    }

    const oldOwnerId = series.createdbyid;

    const affected = await this.seriesRepo.manager.transaction(
      async (manager) => {
        series.createdbyid = newOwnerId;
        await manager.save(series);

        const result = await manager
          .createQueryBuilder()
          .update(CalendarEvent)
          .set({ createdbyid: newOwnerId })
          .where('seriesid = :seriesId', { seriesId })
          .execute();

        return result.affected ?? 0;
      },
    );

    await this.auditLogService.log({
      user: { id: actingUser.id },
      userLabel: actingLabel,
      action: AuditAction.OWNER_CHANGED,
      service: AuditService.EVENTS,
      entityType: AuditEntityType.SERIES_EVENT,
      entityId: seriesId,
      summary: `${actingLabel} hat den Besitzer von Serientermin "${series.title}" (inkl. ${affected} zugehöriger Einzeltermine) von Nutzer #${oldOwnerId} auf ${newOwnerLabel} (#${newOwnerId}) geändert`,
      changes: {
        createdbyid: { old: oldOwnerId, new: newOwnerId },
        affectedCalendarEvents: { old: null, new: affected },
      },
    });

    return {
      success: true,
      seriesId,
      newOwnerId,
      affectedCalendarEvents: affected,
    };
  }

  private async transferCalendarEvent(
    eventId: number,
    newOwnerId: number,
    actingUser: ActingUser,
    actingLabel: string,
    newOwnerLabel: string,
  ) {
    const event = await this.calendarRepo.findOne({ where: { id: eventId } });
    if (!event) {
      throw new NotFoundException(`Termin #${eventId} wurde nicht gefunden.`);
    }

    const oldOwnerId = event.createdbyid;
    event.createdbyid = newOwnerId;

    // Einzelner Termin aus einer Serie: gilt jetzt als manuell abweichend,
    // genau wie bei jeder anderen manuellen Bearbeitung eines Serientermins.
    if (event.seriesid) {
      event.isModified = true;
    }

    await this.calendarRepo.save(event);

    await this.auditLogService.log({
      user: { id: actingUser.id },
      userLabel: actingLabel,
      action: AuditAction.OWNER_CHANGED,
      service: AuditService.EVENTS,
      entityType: AuditEntityType.CALENDAR_EVENT,
      entityId: eventId,
      summary: `${actingLabel} hat den Besitzer von Termin "${event.title}" von Nutzer #${oldOwnerId} auf ${newOwnerLabel} (#${newOwnerId}) geändert`,
      changes: {
        createdbyid: { old: oldOwnerId, new: newOwnerId },
      },
    });

    return { success: true, calendarEventId: eventId, newOwnerId };
  }
}
