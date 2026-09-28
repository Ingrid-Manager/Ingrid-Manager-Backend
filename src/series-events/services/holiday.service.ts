import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CalendarEvent } from '../../calendar-events/infrastructure/relational/persistence/entities/calendar-event.entity';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';

import { resolveHolidayIds } from '../../config/holiday-ids';

@Injectable()
export class HolidayService {
  constructor(
    @InjectRepository(CalendarEvent)
    private readonly calendarRepo: Repository<CalendarEvent>,
    private readonly configService: ConfigService,
  ) {}

  private get holidayCategoryId(): number {
    return resolveHolidayIds(this.configService).categoryId;
  }

  async isSchoolHoliday(date: Date): Promise<boolean> {
    console.log('HOLIDAY CHECK', {
      date: date.toISOString(),
    });

    const holidays = await this.calendarRepo
      .createQueryBuilder('event')
      .where('event.categoryid = :categoryid', {
        categoryid: this.holidayCategoryId,
      })
      .andWhere('event.deletedAt IS NULL')
      .select(['event.id', 'event.start', 'event.end', 'event.categoryid'])
      .getMany();

    console.log(
      'HOLIDAYS',
      holidays.map((holiday) => ({
        id: holiday.id,
        start: holiday.start?.toISOString(),
        end: holiday.end?.toISOString(),
        categoryid: holiday.categoryid,
      })),
    );

    const nextDay = new Date(date);
    nextDay.setHours(0, 0, 0, 0);
    nextDay.setDate(nextDay.getDate() + 1);

    const count = await this.calendarRepo
      .createQueryBuilder('event')
      .where('event.categoryid = :categoryid', {
        categoryid: this.holidayCategoryId,
      })
      .andWhere('event.deletedAt IS NULL')
      // Gleichbedeutend mit DATE(start) <= DATE(:date) AND
      // DATE(end) > DATE(:date) (Ende exklusiv gespeichert), aber ohne
      // Funktion auf den Spalten, damit der Index
      // IDX_CALENDAR_EVENT_HOLIDAY_LOOKUP (categoryid, start, end) greift.
      .andWhere('event.start < :nextDay', { nextDay })
      .andWhere('event.end >= :nextDay', { nextDay })
      .getCount();

    console.log('HOLIDAY RESULT', {
      date: date.toISOString(),
      count,
    });

    return count > 0;
  }
}
