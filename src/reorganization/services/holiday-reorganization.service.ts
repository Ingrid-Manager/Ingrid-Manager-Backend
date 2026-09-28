import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

import { CalendarEvent } from '../../calendar-events/infrastructure/relational/persistence/entities/calendar-event.entity';
import { Category } from '../../categories/infrastructure/relational/persistence/entities/category.entity';
import { Room } from '../../rooms/infrastructure/relational/persistence/entities/room.entity';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { AuditAction } from '../../audit-log/audit-action.enum';
import { AuditEntityType } from '../../audit-log/audit-entity-type.enum';
import { AuditService } from '../../audit-log/audit-service.enum';
import { resolveHolidayIds } from '../../config/holiday-ids';

export interface ReorganizationActingUser {
  id: number;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}

@Injectable()
export class HolidayReorganizationService {
  private readonly logger = new Logger(HolidayReorganizationService.name);

  constructor(
    @InjectRepository(CalendarEvent)
    private readonly calendarEventRepository: Repository<CalendarEvent>,

    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,

    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,

    private readonly configService: ConfigService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async run(user?: ReorganizationActingUser | null): Promise<void> {
    try {
      await this.importOpenHolidays(user);
    } catch (error) {
      await this.auditLogService.log({
        user: null,
        action: AuditAction.SYSTEM_ERROR,
        service: AuditService.REORGANIZATION,
        entityType: AuditEntityType.SYSTEM,
        entityId: null,
        summary: `Ferien-Import fehlgeschlagen: ${(error as Error).message}`,
      });

      throw error;
    }
  }

  /** Alle aktuell importierten Feiertage/Ferien, für die Admin-Übersicht. */
  async list() {
    const holidays = await this.calendarEventRepository.find({
      where: { categoryid: resolveHolidayIds(this.configService).categoryId },
      order: { start: 'ASC' },
    });

    return holidays.map((holiday) => ({
      id: holiday.id,
      title: holiday.title,
      start: holiday.start,
      end: holiday.end,
    }));
  }

  private async importOpenHolidays(
    user?: ReorganizationActingUser | null,
  ): Promise<void> {
    const subdivision = this.configService.get<string>('ORG_BUNDESLAND', {
      infer: true,
    });
    const holidayIds = resolveHolidayIds(this.configService);

    const holidayCategory = await this.categoryRepository.findOne({
      where: {
        id: holidayIds.categoryId,
      },
    });

    if (!holidayCategory) {
      throw new Error(
        `Kategorie "Ferien" (ID ${holidayIds.categoryId}, HOLIDAY_CATEGORY_ID) nicht gefunden`,
      );
    }

    const holidayRoom = await this.roomRepository.findOne({
      where: {
        id: holidayIds.roomId,
      },
    });

    if (!holidayRoom) {
      throw new Error(
        `Raum "Ferien Dummy" (ID ${holidayIds.roomId}, HOLIDAY_ROOM_ID) nicht gefunden`,
      );
    }

    // Besitzer der Ferientermine: der auslösende Admin bzw. beim Cron-Lauf
    // der Ersteller des Ferienraums (statt eines fest angenommenen Users 1).
    const ownerId = user?.id ?? holidayRoom.createdbyid;

    const today = new Date();

    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + 30);

    this.logger.log(`Importing holidays until ${futureDate.toISOString()}`);

    await this.calendarEventRepository.delete({
      categoryid: holidayCategory.id,
      isBackground: true,
      start: MoreThanOrEqual(today),
    });

    const publicHolidays = await axios.get(
      'https://openholidaysapi.org/PublicHolidays',
      {
        params: {
          countryIsoCode: 'DE',
          subdivisionCode: `DE-${subdivision}`,
          languageIsoCode: 'DE',
          validFrom: today.toISOString().split('T')[0],
          validTo: futureDate.toISOString().split('T')[0],
        },
      },
    );

    const schoolHolidays = await axios.get(
      'https://openholidaysapi.org/SchoolHolidays',
      {
        params: {
          countryIsoCode: 'DE',
          subdivisionCode: `DE-${subdivision}`,
          languageIsoCode: 'DE',
          validFrom: today.toISOString().split('T')[0],
          validTo: futureDate.toISOString().split('T')[0],
        },
      },
    );

    const allEvents = [...publicHolidays.data, ...schoolHolidays.data];

    for (const holiday of allEvents) {
      const title =
        holiday.name?.find((x) => x.language === 'DE')?.text ??
        holiday.name?.[0]?.text ??
        'Feiertag';

      // OpenHolidays liefert das Enddatum inklusiv. Gespeichert wird - wie
      // bei ganztägigen Terminen in FullCalendar - exklusiv der Folgetag,
      // sonst fehlt der letzte Ferientag in der Kalenderanzeige.
      const end = new Date(holiday.endDate);
      end.setUTCDate(end.getUTCDate() + 1);

      await this.calendarEventRepository.save(
        this.calendarEventRepository.create({
          title,
          description: '',
          start: new Date(holiday.startDate),
          end,
          allDay: true,
          isBackground: true,
          categoryid: holidayCategory.id,
          roomid: holidayRoom.id,
          createdbyid: ownerId,
        }),
      );
    }

    this.logger.log(`${allEvents.length} Feiertage/Ferien importiert`);

    if (user) {
      const userLabel = await this.auditLogService.getUserLabel(user);
      await this.auditLogService.log({
        user: { id: user.id },
        userLabel,
        action: AuditAction.HOLIDAYS_IMPORTED,
        service: AuditService.REORGANIZATION,
        entityType: AuditEntityType.SYSTEM,
        entityId: null,
        summary: `${userLabel} hat den Ferien-Import manuell ausgelöst (${allEvents.length} importiert)`,
      });
    } else {
      await this.auditLogService.log({
        user: null,
        action: AuditAction.HOLIDAYS_IMPORTED,
        service: AuditService.REORGANIZATION,
        entityType: AuditEntityType.SYSTEM,
        entityId: null,
        summary: `System hat ${allEvents.length} Feiertage/Ferien importiert`,
      });
    }
  }
}
