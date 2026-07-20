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

  /*
   * Wie hasOverlap, gibt aber die konkret betroffenen Termine zurück,
   * damit sie dem Nutzer als Konflikt angezeigt werden können.
   *
   * excludeSeriesId: Termine dieser Serie werden nicht als Konflikt
   * gewertet (z. B. weil sie im selben Vorgang ohnehin gelöscht und
   * neu erzeugt werden - ein Split soll nicht "sich selbst" blockieren).
   */
  async findOverlaps(
    manager: EntityManager,
    roomid: number,
    start: Date,
    end: Date,
    excludeSeriesId?: number,
  ): Promise<CalendarEvent[]> {
    const qb = manager
      .getRepository(CalendarEvent)
      .createQueryBuilder('event')
      .where('event.roomid = :roomid', { roomid })
      .andWhere('event.deletedAt IS NULL')
      .andWhere('event.start < :end', { end })
      .andWhere('event.end > :start', { start });

    if (excludeSeriesId) {
      qb.andWhere(
        '(event.seriesid IS NULL OR event.seriesid != :excludeSeriesId)',
        { excludeSeriesId },
      );
    }

    return qb.getMany();
  }
}
