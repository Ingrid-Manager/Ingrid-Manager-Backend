import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CalendarEventFilterDto } from './application/dto/calendar-event-filter.dto';
import { CalendarEvent } from './infrastructure/relational/persistence/entities/calendar-event.entity';
import { CalnedarEventMapper } from './application/mappers/calendar-event.mapper';
import { RoleEnum } from '../roles/roles.enum';
import { UpdateCalendarEventDto } from './application/dto/update-calendar-event.dto';
import { CreateCalendarEventDto } from './application/dto/create-calendar-event.dto';

@Injectable()
export class CalendarEventsService {
  constructor(
    @InjectRepository(CalendarEvent)
    private repo: Repository<CalendarEvent>,
  ) {}

  private async validateNoOverlap(
    roomid: number,
    start: string | Date,
    end: string | Date,
    excludeId?: number,
  ): Promise<void> {
    const qb = this.repo
      .createQueryBuilder('event')
      .where('event.roomid = :roomid', { roomid })
      .andWhere('event.isBackground = false')
      .andWhere('event.start < :end', { end })
      .andWhere('event.end > :start', { start });

    if (excludeId) {
      qb.andWhere('event.id != :excludeId', {
        excludeId,
      });
    }
    const existingEvent = await qb.getOne();

    if (existingEvent) {
      throw new ConflictException(
        'Für diesen Raum existiert bereits ein Termin in diesem Zeitraum.',
      );
    }
  }

  async create(dto: CreateCalendarEventDto, user: any) {
    await this.validateNoOverlap(dto.roomid, dto.start, dto.end);

    const event = this.repo.create({
      title: dto.title,
      start: new Date(dto.start),
      end: new Date(dto.end),
      allDay: dto.allDay,
      description: dto.description,
      isBackground: dto.isBackground,
      rrule: dto.rrule,
      roomid: dto.roomid,
      categoryid: dto.categoryid,
      createdbyid: user.id,
    });

    return this.repo.save(event);
  }

  async findInRange(filter: CalendarEventFilterDto) {
    const qb = this.repo
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.room', 'room')
      .leftJoinAndSelect('event.category', 'category')
      .leftJoinAndSelect('event.user', 'user')
      .where('event.start <= :end', { end: filter.end })
      .andWhere('event.end >= :start', { start: filter.start });

    if (filter.roomid) {
      qb.andWhere('event.roomid = :roomid', { roomid: filter.roomid });
    }

    if (filter.categoryid) {
      qb.andWhere('event.categoryid = :categoryid', {
        categoryid: filter.categoryid,
      });
    }

    if (filter.isBackground !== undefined) {
      qb.andWhere('event.isBackground = :isBackground', {
        isBackground: filter.isBackground,
      });
    }

    console.log(filter);
    console.log(typeof filter.isBackground);
    console.log(filter.isBackground);
    console.log(qb.getSql());
    console.log(qb.getParameters());

    const events = await qb.getMany();

    return events.map(CalnedarEventMapper.toResponse);
  }

  async update(dto: UpdateCalendarEventDto, user: any) {
    const event = await this.repo.findOne({
      where: { id: dto.id },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    // normale User dürfen nur eigene Events bearbeiten
    if (user.role?.name === RoleEnum.user && event.createdbyid !== user.id) {
      throw new ForbiddenException('You cannot edit this event');
    }

    await this.validateNoOverlap(
      dto.roomid ?? event.roomid,
      dto.start ?? event.start,
      dto.end ?? event.end,
      event.id,
    );

    Object.assign(event, dto);

    return this.repo.save(event);
  }

  async delete(id: number, user: any) {
    const event = await this.repo.findOne({
      where: { id },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    if (user.role.id == RoleEnum.user && event.createdbyid !== user.id) {
      throw new ForbiddenException('You cannot delete this event');
    }

    await this.repo.softDelete(id);

    return { success: true };
  }
}
