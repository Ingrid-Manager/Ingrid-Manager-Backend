import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { CalendarEvent } from '../../calendar-events/infrastructure/relational/persistence/entities/calendar-event.entity';

@Injectable()
export class OverlapService {
  async hasOverlap(
    manager: EntityManager,
    roomid: number,
    start: Date,
    end: Date,
  ): Promise<boolean> {
    const count = await manager
      .getRepository(CalendarEvent)
      .createQueryBuilder('event')
      .where('event.roomid = :roomid', { roomid })
      .andWhere('event.deletedAt IS NULL')
      .andWhere('event.start < :end', { end })
      .andWhere('event.end > :start', { start })
      .getCount();

    return count > 0;
  }
}
