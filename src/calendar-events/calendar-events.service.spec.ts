import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException } from '@nestjs/common';

import { CalendarEventsService } from './calendar-events.service';
import { CalendarEvent } from './infrastructure/relational/persistence/entities/calendar-event.entity';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditAction } from '../audit-log/audit-action.enum';
import { AuditEntityType } from '../audit-log/audit-entity-type.enum';
import { AuditService } from '../audit-log/audit-service.enum';

describe('CalendarEventsService', () => {
  let service: CalendarEventsService;
  let auditLogService: {
    log: jest.Mock;
    getUserLabel: jest.Mock;
    diff: jest.Mock;
    snapshot: jest.Mock;
  };

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
      snapshot: jest.fn().mockReturnValue({}),
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
        service: AuditService.EVENTS,
        entityType: AuditEntityType.CALENDAR_EVENT,
        summary: expect.stringContaining('Teamsitzung'),
      }),
    );
  });

  it('logs an UPDATE entry with a full snapshot when a calendar event is edited', async () => {
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

    // snapshot() statt diff(): das Protokoll soll immer den vollständigen
    // Termin zeigen (Datum/Raum/...), nicht nur die geänderten Felder.
    expect(auditLogService.snapshot).toHaveBeenCalled();
    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.UPDATE,
        service: AuditService.EVENTS,
        entityType: AuditEntityType.CALENDAR_EVENT,
        entityId: 7,
      }),
    );
  });

  it('forbids a "user"-role account from editing an event created by someone else', async () => {
    const user = { id: 99, role: { id: 2, name: 'user' } };
    mockRepository.findOne.mockResolvedValueOnce({
      id: 7,
      title: 'Fremdes Meeting',
      start: new Date('2026-01-01T10:00:00.000Z'),
      end: new Date('2026-01-01T11:00:00.000Z'),
      roomid: 1,
      createdbyid: 42,
    });

    await expect(
      service.update({ id: 7, title: 'Hijacked' } as any, user),
    ).rejects.toThrow(ForbiddenException);

    expect(auditLogService.log).not.toHaveBeenCalled();
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
    expect(auditLogService.snapshot).toHaveBeenCalled();
    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.DELETE,
        service: AuditService.EVENTS,
        entityType: AuditEntityType.CALENDAR_EVENT,
        entityId: 9,
        summary: expect.stringContaining('gelöscht'),
      }),
    );
  });
});
