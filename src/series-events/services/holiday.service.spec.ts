import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';

import { CalendarEvent } from '../../calendar-events/infrastructure/relational/persistence/entities/calendar-event.entity';
import { HolidayService } from './holiday.service';

describe('HolidayService', () => {
  const createService = (count: number) => {
    const conditions: Array<[string, Record<string, unknown> | undefined]> = [];
    const queryBuilder = {
      where: jest.fn((sql: string, params?: Record<string, unknown>) => {
        conditions.push([sql, params]);
        return queryBuilder;
      }),
      andWhere: jest.fn((sql: string, params?: Record<string, unknown>) => {
        conditions.push([sql, params]);
        return queryBuilder;
      }),
      select: jest.fn(() => queryBuilder),
      getMany: jest.fn().mockResolvedValue([]),
      getCount: jest.fn().mockResolvedValue(count),
    };
    const repo = { createQueryBuilder: jest.fn(() => queryBuilder) };
    const service = new HolidayService(
      repo as unknown as Repository<CalendarEvent>,
      { get: jest.fn() } as unknown as ConfigService,
    );

    return { service, conditions };
  };

  it('should compare against the start of the following day without DATE() on columns', async () => {
    const { service, conditions } = createService(1);

    await expect(
      service.isSchoolHoliday(new Date(2026, 9, 23, 18, 30)),
    ).resolves.toBe(true);

    const countConditions = conditions.slice(-4);
    expect(countConditions.map(([sql]) => sql)).toEqual([
      'event.categoryid = :categoryid',
      'event.deletedAt IS NULL',
      'event.start < :nextDay',
      'event.end >= :nextDay',
    ]);
    expect(countConditions[0][1]).toEqual({ categoryid: 9999 });
    expect(countConditions[2][1]).toEqual({
      nextDay: new Date(2026, 9, 24, 0, 0, 0, 0),
    });
  });

  it('should report no holiday when nothing matches', async () => {
    const { service } = createService(0);

    await expect(service.isSchoolHoliday(new Date(2026, 9, 26))).resolves.toBe(
      false,
    );
  });
});
