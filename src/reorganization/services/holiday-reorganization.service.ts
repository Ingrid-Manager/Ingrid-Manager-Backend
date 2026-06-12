import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import axios from 'axios';

import { CalendarEvent } from '../../calendar-events/infrastructure/relational/persistence/entities/calendar-event.entity';
import { Category } from '../../categories/infrastructure/relational/persistence/entities/category.entity';
import { Room } from '../../rooms/infrastructure/relational/persistence/entities/room.entity';

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
  ) {}

  async run(): Promise<void> {
    await this.importOpenHolidays();
  }

  private async importOpenHolidays(): Promise<void> {
    const holidayCategory = await this.categoryRepository.findOne({
      where: {
        title: 'Ferien',
      },
    });

    if (!holidayCategory) {
      throw new Error('Kategorie "Ferien" nicht gefunden');
    }

    const holidayRoom = await this.roomRepository.findOne({
      where: {
        title: 'Dummy',
      },
    });

    if (!holidayRoom) {
      throw new Error('Raum "Dummy" nicht gefunden');
    }

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
          subdivisionCode: 'DE-NI',
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
          subdivisionCode: 'DE-NI',
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

      await this.calendarEventRepository.save(
        this.calendarEventRepository.create({
          title,
          description: '',
          start: new Date(holiday.startDate),
          end: new Date(holiday.endDate),
          allDay: true,
          isBackground: true,
          categoryid: holidayCategory.id,
          roomid: holidayRoom.id,
          createdbyid: 1,
        }),
      );
    }

    this.logger.log(`${allEvents.length} Feiertage/Ferien importiert`);
  }
}
