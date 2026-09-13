import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { CalendarEventsService } from './calendar-events.service';
import { CalendarEvent } from './infrastructure/relational/persistence/entities/calendar-event.entity';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditAction } from '../audit-log/audit-action.enum';
import { AuditEntityType } from '../audit-log/audit-entity-type.enum';

describe('CalendarEventsService', () => {
  let service: CalendarEventsService;
  let auditLogService: { log: jest.Mock; getUserLabel: jest.Mock; diff: jest.Mock };

  const mockQueryBuilder = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(null),
    getMany: jest.fn().mockResolvedValue([]),
  };

  const mockRepository = {
    create: jest.fn((data) => data),
    save: jest.fn(async (data) => ({ id: 1, ...data })),
    findOne: jest.fn(),
    softDelete: jest.fn(),
    createQueryBuilder: jest.fn(() => mockQueryBuilder),
  };

  beforeEach(async () => {
    auditLogService = {
      log: jest.fn().mockResolvedValue(undefined),
      getUserLabel: jest.fn().mockResolvedValue('Anna Beispiel'),
      diff: jest.fn().mockReturnValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CalendarEventsService,
        {
          provide: getRepositoryToken(CalendarEvent),
          useValue: mockRepository,
        },
        {
          provide: AuditLogService,
          useValue: auditLogService,
        },
      ],
    }).compile();

    service = module.get<CalendarEventsService>(CalendarEventsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('logs a CREATE entry when a calendar event is created', async () => {
    const user = { id: 42, role: { id: 2, name: 'user' } };

    await service.create(
      {
        title: 'Teamsitzung',
        start: '2026-01-01T10:00:00.000Z',
        end: '2026-01-01T11:00:00.000Z',
        allDay: false,
        roomid: 1,
        categoryid: 1,
      } as any,
      user,
    );

    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        user: { id: 42 },
        action: AuditAction.CREATE,
        entityType: AuditEntityType.CALENDAR_EVENT,
        summary: expect.stringContaining('Teamsitzung'),
      }),
    );
  });

  it('logs an UPDATE entry with a diff when a calendar event is edited', async () => {
    const user = { id: 42, role: { id: 1, name: 'admin' } };
    mockRepository.findOne.mockResolvedValueOnce({
      id: 7,
      title: 'Altes Meeting',
      start: new Date('2026-01-01T10:00:00.000Z'),
      end: new Date('2026-01-01T11:00:00.000Z'),
      roomid: 1,
      createdbyid: 42,
    });

    await service.update({ id: 7, title: 'Neues Meeting' } as any, user);

    expect(auditLogService.diff).toHaveBeenCalled();
    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.UPDATE,
        entityType: AuditEntityType.CALENDAR_EVENT,
        entityId: 7,
      }),
    );
  });

  it('logs a DELETE entry when a calendar event is soft-deleted', async () => {
    const user = { id: 42, role: { id: 1, name: 'admin' } };
    mockRepository.findOne.mockResolvedValueOnce({
      id: 9,
      title: 'Zu löschendes Meeting',
      createdbyid: 42,
      seriesid: null,
    });

    await service.delete(9, user);

    expect(mockRepository.softDelete).toHaveBeenCalledWith(9);
    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.DELETE,
        entityType: AuditEntityType.CALENDAR_EVENT,
        entityId: 9,
        summary: expect.stringContaining('gelöscht'),
      }),
    );
  });
});
