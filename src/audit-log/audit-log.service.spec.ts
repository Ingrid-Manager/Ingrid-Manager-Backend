import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { AuditLogService } from './audit-log.service';
import { AuditLog } from './infrastructure/relational/persistence/entities/audit-log.entity';
import { UserEntity } from '../users/infrastructure/persistence/relational/entities/user.entity';
import { AuditAction } from './audit-action.enum';

describe('AuditLogService', () => {
  let service: AuditLogService;
  let auditLogRepository: { create: jest.Mock; save: jest.Mock };
  let userRepository: { findOne: jest.Mock };

  beforeEach(async () => {
    auditLogRepository = {
      create: jest.fn((data) => data),
      save: jest.fn().mockResolvedValue(undefined),
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
        entityType: 'system',
        entityId: null,
        summary: 'Testfehler',
      });

      expect(auditLogRepository.save).toHaveBeenCalled();
      const saved = auditLogRepository.create.mock.calls[0][0];
      expect(saved.userLabel).toBe('System');
      expect(saved.userId).toBeNull();
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

    it('never throws when saving fails', async () => {
      auditLogRepository.save.mockRejectedValueOnce(new Error('DB down'));

      await expect(
        service.log({
          user: null,
          action: AuditAction.SYSTEM_ERROR,
          entityType: 'system',
          entityId: null,
          summary: 'Test',
        }),
      ).resolves.toBeUndefined();
    });
  });
});
