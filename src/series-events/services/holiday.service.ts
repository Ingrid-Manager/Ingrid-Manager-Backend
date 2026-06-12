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
    const count = await this.calendarRepo
      .createQueryBuilder('event')
      .where('event.categoryid = :categoryid', {
        categoryid: HolidayService.HOLIDAY_CATEGORY_ID,
      })
      .andWhere('event.deletedAt IS NULL')
      .andWhere('event.start <= :date', { date })
      .andWhere('event.end >= :date', { date })
      .getCount();

    return count > 0;
  }
}
