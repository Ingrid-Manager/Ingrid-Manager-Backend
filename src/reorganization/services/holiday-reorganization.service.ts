import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

import { CalendarEvent } from '../../calendar-events/infrastructure/relational/persistence/entities/calendar-event.entity';
import { Category } from '../../categories/infrastructure/relational/persistence/entities/category.entity';
import { Room } from '../../rooms/infrastructure/relational/persistence/entities/room.entity';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { AuditAction } from '../../audit-log/audit-action.enum';
import { AuditEntityType } from '../../audit-log/audit-entity-type.enum';
import { AuditService } from '../../audit-log/audit-service.enum';

export interface ReorganizationActingUser {
  id: number;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}

@Injectable()
export class HolidayReorganizationService {
  private readonly logger = new Logger(HolidayReorganizationService.name);

  // Feste Kategorie-ID für importierte Feiertage/Ferien (siehe importOpenHolidays unten).
  private static readonly HOLIDAY_CATEGORY_ID = 9999;

  constructor(
    @InjectRepository(CalendarEvent)
    private readonly calendarEventRepository: Repository<CalendarEvent>,

    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,

    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,

    private readonly configService: ConfigService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async run(user?: ReorganizationActingUser | null): Promise<void> {
    try {
      await this.importOpenHolidays(user);
    } catch (error) {
      await this.auditLogService.log({
        user: null,
        action: AuditAction.SYSTEM_ERROR,
        service: AuditService.REORGANIZATION,
        entityType: AuditEntityType.SYSTEM,
        entityId: null,
        summary: `Ferien-Import fehlgeschlagen: ${(error as Error).message}`,
      });

      throw error;
    }
  }

  /** Alle aktuell importierten Feiertage/Ferien, für die Admin-Übersicht. */
  async list() {
    const holidays = await this.calendarEventRepository.find({
      where: { categoryid: HolidayReorganizationService.HOLIDAY_CATEGORY_ID },
      order: { start: 'ASC' },
    });

    return holidays.map((holiday) => ({
      id: holiday.id,
      title: holiday.title,
      start: holiday.start,
      end: holiday.end,
    }));
  }

  private async importOpenHolidays(
    user?: ReorganizationActingUser | null,
  ): Promise<void> {
    const subdivision = this.configService.get<string>('ORG_BUNDESLAND', {
      infer: true,
    });

    const holidayCategory = await this.categoryRepository.findOne({
      where: {
        id: HolidayReorganizationService.HOLIDAY_CATEGORY_ID,
      },
    });

    if (!holidayCategory) {
      throw new Error('Kategorie "Ferien" nicht gefunden');
    }

    const holidayRoom = await this.roomRepository.findOne({
      where: {
        id: 9999,
      },
    });

    if (!holidayRoom) {
      throw new Error('Raum "Ferien Dummy" nicht gefunden');
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
          subdivisionCode: `DE-${subdivision}`,
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
          subdivisionCode: `DE-${subdivision}`,
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

    if (user) {
      const userLabel = await this.auditLogService.getUserLabel(user);
      await this.auditLogService.log({
        user: { id: user.id },
        userLabel,
        action: AuditAction.HOLIDAYS_IMPORTED,
        service: AuditService.REORGANIZATION,
        entityType: AuditEntityType.SYSTEM,
        entityId: null,
        summary: `${userLabel} hat den Ferien-Import manuell ausgelöst (${allEvents.length} importiert)`,
      });
    } else {
      await this.auditLogService.log({
        user: null,
        action: AuditAction.HOLIDAYS_IMPORTED,
        service: AuditService.REORGANIZATION,
        entityType: AuditEntityType.SYSTEM,
        entityId: null,
        summary: `System hat ${allEvents.length} Feiertage/Ferien importiert`,
      });
    }
  }
}
