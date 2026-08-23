import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CalendarEvent } from '../../calendar-events/infrastructure/relational/persistence/entities/calendar-event.entity';
import { Repository } from 'typeorm';

@Injectable()
export class HolidayService {
  private static readonly HOLIDAY_CATEGORY_ID = 9999;

  constructor(
    @InjectRepository(CalendarEvent)
    private readonly calendarRepo: Repository<CalendarEvent>,
  ) {}

  async isSchoolHoliday(date: Date): Promise<boolean> {
    console.log('HOLIDAY CHECK', {
      date: date.toISOString(),
    });

    const holidays = await this.calendarRepo
      .createQueryBuilder('event')
      .where('event.categoryid = :categoryid', {
        categoryid: HolidayService.HOLIDAY_CATEGORY_ID,
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

    const count = await this.calendarRepo
      .createQueryBuilder('event')
      .where('event.categoryid = :categoryid', {
        categoryid: HolidayService.HOLIDAY_CATEGORY_ID,
      })
      .andWhere('event.deletedAt IS NULL')
      .andWhere('DATE(event.start) <= DATE(:date)', { date })
      .andWhere('DATE(event.end) >= DATE(:date)', { date })
      .getCount();

    console.log('HOLIDAY RESULT', {
      date: date.toISOString(),
      count,
    });

    return count > 0;
  }
}
