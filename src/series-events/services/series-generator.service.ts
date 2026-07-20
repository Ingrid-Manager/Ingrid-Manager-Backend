import { Injectable } from '@nestjs/common';

import { EntityManager } from 'typeorm';

import { CalendarEvent } from '../../calendar-events/infrastructure/relational/persistence/entities/calendar-event.entity';

import { SeriesEvent } from '../infrastructure/relational/persistence/entities/series-event.entity';
import { OverlapService } from './overlap.service';
import { HolidayService } from './holiday.service';

export interface SeriesConflictEvent {
  id: number;
  title: string;
  start: Date;
  end: Date;
}

export interface SeriesConflict {
  start: Date;
  end: Date;
  conflictingEvents: SeriesConflictEvent[];
}

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
    let matchingWeekdays = 0;
    let matchingFrequency = 0;
    const current = new Date(from);

    while (current <= until && current <= series.seriesEnd) {
      const weekday = current.getDay();

      const mappedWeekday = weekday === 0 ? 7 : weekday;

      if (!this.matchesFrequency(series, current)) {
        current.setDate(current.getDate() + 1);
        continue;
      }
      matchingFrequency++;

      if (series.weekdays.includes(mappedWeekday)) {
        matchingWeekdays++;

        await this.createOccurrence(manager, series, current);
      }

      current.setDate(current.getDate() + 1);
    }
    console.log({
      matchingFrequency,
      matchingWeekdays,
    });
  }

  /*
   * Simuliert dieselbe Terminreihe wie generateRange, schreibt aber
   * nichts in die Datenbank. Stattdessen werden alle Tage, an denen
   * ein Raumkonflikt bestehen würde, inkl. der konkret kollidierenden
   * Termine gesammelt und zurückgegeben.
   *
   * excludeSeriesId: Termine dieser Serie zählen nicht als Konflikt,
   * da sie im selben Vorgang gelöscht und ersetzt werden.
   */
  async checkRangeConflicts(
    manager: EntityManager,
    series: SeriesEvent,
    from: Date,
    until: Date,
    excludeSeriesId?: number,
  ): Promise<SeriesConflict[]> {
    const conflicts: SeriesConflict[] = [];
    const current = new Date(from);

    while (current <= until && current <= series.seriesEnd) {
      const weekday = current.getDay();
      const mappedWeekday = weekday === 0 ? 7 : weekday;

      if (!this.matchesFrequency(series, current)) {
        current.setDate(current.getDate() + 1);
        continue;
      }

      if (series.weekdays.includes(mappedWeekday)) {
        const start = new Date(current);
        const end = new Date(current);

        this.applyTime(start, series.startTime);
        this.applyTime(end, series.endTime);

        if (!series.runDuringSchoolHolidays) {
          const isHoliday = await this.holidayService.isSchoolHoliday(start);

          if (isHoliday) {
            current.setDate(current.getDate() + 1);
            continue;
          }
        }

        const overlaps = await this.overlapService.findOverlaps(
          manager,
          series.roomid,
          start,
          end,
          excludeSeriesId,
        );

        if (overlaps.length > 0) {
          conflicts.push({
            start,
            end,
            conflictingEvents: overlaps.map((e) => ({
              id: e.id,
              title: e.title,
              start: e.start,
              end: e.end,
            })),
          });
        }
      }

      current.setDate(current.getDate() + 1);
    }

    return conflicts;
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
    });

    if (existing) {
      console.log('EXISTING', start.toISOString());
      return;
    }

    /*
     * Raumkonflikt?.
     */
    const overlap = await this.overlapService.hasOverlap(
      manager,
      series.roomid,
      start,
      end,
    );

    if (overlap) {
      console.log('OVERLAP', start.toISOString());
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

  private matchesFrequency(series: SeriesEvent, current: Date): boolean {
    if (series.frequency === 'WEEKLY') {
      return true;
    }

    const diffDays = Math.floor(
      (current.getTime() - series.seriesStart.getTime()) /
        (1000 * 60 * 60 * 24),
    );

    const diffWeeks = Math.floor(diffDays / 7);
    const result = diffWeeks % 2 === 0;
    /*console.log({
      current: current.toISOString(),
      seriesStart: series.seriesStart.toISOString(),
      diffDays,
      diffWeeks,
      result,
    });*/
    return result;
  }
}
