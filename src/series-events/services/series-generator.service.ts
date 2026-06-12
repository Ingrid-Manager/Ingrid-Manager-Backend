import { Injectable } from '@nestjs/common';

import { EntityManager } from 'typeorm';

import { CalendarEvent } from '../../calendar-events/infrastructure/relational/persistence/entities/calendar-event.entity';

import { SeriesEvent } from '../infrastructure/relational/persistence/entities/series-event.entity';
import { OverlapService } from './overlap.service';
import { HolidayService } from './holiday.service';

@Injectable()
export class SeriesGeneratorService {
  constructor(
    private readonly overlapService: OverlapService,

    private readonly holidayService: HolidayService,
  ) {}

  async generateRange(
    manager: EntityManager,
    series: SeriesEvent,
    from: Date,
    until: Date,
  ): Promise<void> {
    const current = new Date(from);

    while (current <= until && current <= series.seriesEnd) {
      const weekday = current.getDay();

      const mappedWeekday = weekday === 0 ? 7 : weekday;

      if (series.weekdays.includes(mappedWeekday)) {
        await this.createOccurrence(manager, series, current);
      }

      current.setDate(current.getDate() + 1);
    }
  }

  private async createOccurrence(
    manager: EntityManager,
    series: SeriesEvent,
    day: Date,
  ) {
    const start = new Date(day);
    const end = new Date(day);

    this.applyTime(start, series.startTime);
    this.applyTime(end, series.endTime);

    /*
     * Ferienprüfung
     */
    if (!series.runDuringSchoolHolidays) {
      const isHoliday = await this.holidayService.isSchoolHoliday(start);

      if (isHoliday) {
        return;
      }
    }

    /*
     * Existiert bereits?
     */
    const existing = await manager.getRepository(CalendarEvent).findOne({
      where: {
        seriesid: series.id,
        start,
      },
      withDeleted: true,
    });

    if (existing) {
      return;
    }

    /*
     * Raumkonflikt?
     */
    const overlap = await this.overlapService.hasOverlap(
      series.roomid,
      start,
      end,
    );

    if (overlap) {
      return;
    }

    const event = manager.getRepository(CalendarEvent).create({
      title: series.title,
      description: series.description,

      start,
      end,

      roomid: series.roomid,
      categoryid: series.categoryid,
      createdbyid: series.createdbyid,

      seriesid: series.id,

      isModified: false,
      allDay: false,
      isBackground: false,
    });

    await manager.getRepository(CalendarEvent).save(event);
  }

  private applyTime(date: Date, time: string) {
    const [hour, minute] = time.split(':').map(Number);
    date.setHours(hour, minute, 0, 0);
  }
}
