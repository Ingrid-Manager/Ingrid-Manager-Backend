import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { CalendarEvent } from '../../calendar-events/infrastructure/relational/persistence/entities/calendar-event.entity';

@Injectable()
export class OverlapService {
  constructor(
    @InjectRepository(CalendarEvent)
    private readonly eventRepo: Repository<CalendarEvent>,
  ) {}

  async hasOverlap(roomid: number, start: Date, end: Date): Promise<boolean> {
    const count = await this.eventRepo
      .createQueryBuilder('event')
      .where('event.roomid = :roomid', {
        roomid,
      })
      .andWhere('event.deletedAt IS NULL')
      .andWhere('event.start < :end', {
        end,
      })
      .andWhere('event.end > :start', {
        start,
      })
      .getCount();

    return count > 0;
  }
}
