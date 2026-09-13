import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

import { HolidayReorganizationService } from './holiday-reorganization.service';
import { CalendarEvent } from '../../calendar-events/infrastructure/relational/persistence/entities/calendar-event.entity';
import { Category } from '../../categories/infrastructure/relational/persistence/entities/category.entity';
import { Room } from '../../rooms/infrastructure/relational/persistence/entities/room.entity';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { AuditAction } from '../../audit-log/audit-action.enum';

jest.mock('axios');

describe('HolidayReorganizationService', () => {
  let service: HolidayReorganizationService;
  let auditLogService: { log: jest.Mock; getUserLabel: jest.Mock };
  let calendarEventRepository: {
    delete: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
  };

  beforeEach(async () => {
    calendarEventRepository = {
      delete: jest.fn().mockResolvedValue(undefined),
      create: jest.fn((data) => data),
      save: jest.fn().mockResolvedValue(undefined),
    };
    auditLogService = {
      log: jest.fn().mockResolvedValue(undefined),
      getUserLabel: jest.fn().mockResolvedValue('Admin Beispiel'),
    };

    (axios.get as jest.Mock).mockResolvedValue({ data: [] });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HolidayReorganizationService,
        {
          provide: getRepositoryToken(CalendarEvent),
          useValue: calendarEventRepository,
        },
        {
          provide: getRepositoryToken(Category),
          useValue: { findOne: jest.fn().mockResolvedValue({ id: 9999 }) },
        },
        {
          provide: getRepositoryToken(Room),
          useValue: { findOne: jest.fn().mockResolvedValue({ id: 9999 }) },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('NI') },
        },
        { provide: AuditLogService, useValue: auditLogService },
      ],
    }).compile();

    service = module.get<HolidayReorganizationService>(
      HolidayReorganizationService,
    );
  });

  it('logs HOLIDAYS_IMPORTED with the correct count on a system-triggered run', async () => {
    (axios.get as jest.Mock)
      .mockResolvedValueOnce({ data: [{ name: [{ language: 'DE', text: 'Weihnachten' }], startDate: '2026-12-25', endDate: '2026-12-26' }] })
      .mockResolvedValueOnce({ data: [{ name: [{ language: 'DE', text: 'Sommerferien' }], startDate: '2026-07-01', endDate: '2026-08-01' }] });

    await service.run();

    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.HOLIDAYS_IMPORTED,
        user: null,
        summary: 'System hat 2 Feiertage/Ferien importiert',
      }),
    );
  });

  it('logs with the acting admin when triggered manually', async () => {
    await service.run({ id: 42, email: 'admin@example.com' });

    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.HOLIDAYS_IMPORTED,
        user: { id: 42 },
      }),
    );
  });

  it('logs a SYSTEM_ERROR entry and rethrows when the import fails', async () => {
    (axios.get as jest.Mock).mockRejectedValue(new Error('network down'));

    await expect(service.run()).rejects.toThrow('network down');

    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: AuditAction.SYSTEM_ERROR }),
    );
  });
});
