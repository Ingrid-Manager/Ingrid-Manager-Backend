import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { AuditLogService } from './audit-log.service';
import { AuditLog } from './infrastructure/relational/persistence/entities/audit-log.entity';
import { UserEntity } from '../users/infrastructure/persistence/relational/entities/user.entity';
import { AuditAction } from './audit-action.enum';
import { AuditService } from './audit-service.enum';

describe('AuditLogService', () => {
  let service: AuditLogService;
  let auditLogRepository: {
    create: jest.Mock;
    save: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let userRepository: { findOne: jest.Mock };
  let mockQueryBuilder: {
    orderBy: jest.Mock;
    andWhere: jest.Mock;
    skip: jest.Mock;
    take: jest.Mock;
    getManyAndCount: jest.Mock;
  };

  beforeEach(async () => {
    mockQueryBuilder = {
      orderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    auditLogRepository = {
      create: jest.fn((data) => data),
      save: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn(() => mockQueryBuilder),
    };
    userRepository = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogService,
        { provide: getRepositoryToken(AuditLog), useValue: auditLogRepository },
        { provide: getRepositoryToken(UserEntity), useValue: userRepository },
      ],
    }).compile();

    service = module.get<AuditLogService>(AuditLogService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getUserLabel', () => {
    it('never throws when the user lookup fails, so callers can rely on it before their own action succeeds', async () => {
      userRepository.findOne.mockRejectedValueOnce(new Error('connection lost'));

      await expect(service.getUserLabel({ id: 9 })).resolves.toBe('User #9');
    });
  });

  describe('diff', () => {
    it('only reports fields that actually changed', () => {
      const before = { title: 'Alt', roomid: 1, description: 'x' };
      const after = { title: 'Neu', roomid: 1 };

      const changes = service.diff(before, after);

      expect(changes).toEqual({ title: { old: 'Alt', new: 'Neu' } });
    });

    it('ignores technical and sensitive fields by default', () => {
      const before = {
        password: 'oldhash',
        updatedAt: new Date('2026-01-01'),
        firstName: 'Alt',
      };
      const after = {
        password: 'newhash',
        updatedAt: new Date('2026-02-01'),
        firstName: 'Neu',
      };

      const changes = service.diff(before, after);

      expect(changes).toEqual({ firstName: { old: 'Alt', new: 'Neu' } });
    });

    it('respects additional ignoreFields', () => {
      const before = { secretToken: 'a', title: 'Alt' };
      const after = { secretToken: 'b', title: 'Neu' };

      const changes = service.diff(before, after, ['secretToken']);

      expect(changes).toEqual({ title: { old: 'Alt', new: 'Neu' } });
    });
  });

  describe('log', () => {
    it('resolves "System" as userLabel when no user is given', async () => {
      await service.log({
        user: null,
        action: AuditAction.SYSTEM_ERROR,
        service: AuditService.SYSTEM,
        entityType: 'system',
        entityId: null,
        summary: 'Testfehler',
      });

      expect(auditLogRepository.save).toHaveBeenCalled();
      const saved = auditLogRepository.create.mock.calls[0][0];
      expect(saved.userLabel).toBe('System');
      expect(saved.userId).toBeNull();
      expect(saved.service).toBe(AuditService.SYSTEM);
    });

    it('loads the display name via withDeleted when only the id is given', async () => {
      userRepository.findOne.mockResolvedValue({
        id: 3,
        firstName: 'Max',
        lastName: 'Mustermann',
        email: 'max@example.com',
      });

      await service.log({
        user: { id: 3 },
        action: AuditAction.CREATE,
        service: AuditService.EVENTS,
        entityType: 'calendar-event',
        entityId: 1,
        summary: 'Test',
      });

      expect(userRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 3 }, withDeleted: true }),
      );
      const saved = auditLogRepository.create.mock.calls[0][0];
      expect(saved.userLabel).toBe('Max Mustermann');
    });

    it('never throws when getUserLabel fails to load the display name', async () => {
      userRepository.findOne.mockRejectedValueOnce(new Error('DB down'));

      await expect(
        service.log({
          user: { id: 3 },
          action: AuditAction.CREATE,
          service: AuditService.EVENTS,
          entityType: 'calendar-event',
          entityId: 1,
          summary: 'Test',
        }),
      ).resolves.toBeUndefined();

      expect(auditLogRepository.save).toHaveBeenCalled();
      const saved = auditLogRepository.create.mock.calls[0][0];
      expect(saved.userLabel).toBe('User #3');
    });

    it('never throws when saving fails', async () => {
      auditLogRepository.save.mockRejectedValueOnce(new Error('DB down'));

      await expect(
        service.log({
          user: null,
          action: AuditAction.SYSTEM_ERROR,
          service: AuditService.SYSTEM,
          entityType: 'system',
          entityId: null,
          summary: 'Test',
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('findAll', () => {
    it('filters by service when given', async () => {
      await service.findAll({ service: AuditService.AUTH } as any);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'log.service = :service',
        { service: AuditService.AUTH },
      );
    });

    it('does not add a service filter when none is given', async () => {
      await service.findAll({} as any);

      expect(mockQueryBuilder.andWhere).not.toHaveBeenCalledWith(
        expect.stringContaining('log.service'),
        expect.anything(),
      );
    });
  });
});
