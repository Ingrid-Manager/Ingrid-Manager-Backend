import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException } from '@nestjs/common';

import { ResourceEventsService } from './resource-events.service';
import { ResourceEvent } from './infrastructure/relational/persistence/entities/resource-event.entity';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditAction } from '../audit-log/audit-action.enum';

describe('ResourceEventsService', () => {
  let service: ResourceEventsService;
  let auditLogService: { log: jest.Mock; getUserLabel: jest.Mock; diff: jest.Mock };

  const mockQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
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
        ResourceEventsService,
        {
          provide: getRepositoryToken(ResourceEvent),
          useValue: mockRepository,
        },
        { provide: AuditLogService, useValue: auditLogService },
      ],
    }).compile();

    service = module.get<ResourceEventsService>(ResourceEventsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('forbids a "user"-role account from editing a booking created by someone else', async () => {
    const user = { id: 99, role: { id: 2, name: 'user' } };
    mockRepository.findOne.mockResolvedValueOnce({
      id: 5,
      title: 'Fremde Buchung',
      start: new Date('2026-01-01T10:00:00.000Z'),
      end: new Date('2026-01-01T11:00:00.000Z'),
      resourceid: 1,
      createdbyid: 42,
    });

    await expect(
      service.update(
        {
          id: 5,
          start: '2026-01-01T10:00:00.000Z',
          end: '2026-01-01T11:00:00.000Z',
        } as any,
        user,
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(auditLogService.log).not.toHaveBeenCalled();
  });

  it('forbids a "user"-role account from deleting a booking created by someone else', async () => {
    const user = { id: 99, role: { id: 2, name: 'user' } };
    mockRepository.findOne.mockResolvedValueOnce({
      id: 5,
      title: 'Fremde Buchung',
      createdbyid: 42,
    });

    await expect(service.delete(5, user)).rejects.toThrow(ForbiddenException);

    expect(auditLogService.log).not.toHaveBeenCalled();
  });

  it('logs a CREATE entry when a resource booking is created', async () => {
    const user = { id: 42, role: { id: 2, name: 'user' } };

    await service.create(
      {
        title: 'Beamer reserviert',
        start: '2026-01-01T10:00:00.000Z',
        end: '2026-01-01T11:00:00.000Z',
        resourceid: 1,
      } as any,
      user,
    );

    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.CREATE,
        summary: expect.stringContaining('Beamer reserviert'),
      }),
    );
  });
});
