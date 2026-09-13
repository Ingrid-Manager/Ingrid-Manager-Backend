import { Test, TestingModule } from '@nestjs/testing';

import { UsersService } from './users.service';
import { UserRepository } from './infrastructure/persistence/user.repository';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditAction } from '../audit-log/audit-action.enum';
import { StatusEnum } from '../statuses/statuses.enum';
import { RoleEnum } from '../roles/roles.enum';

describe('UsersService', () => {
  let service: UsersService;
  let usersRepository: {
    findById: jest.Mock;
    update: jest.Mock;
    create: jest.Mock;
    remove: jest.Mock;
  };
  let auditLogService: {
    log: jest.Mock;
    getUserLabel: jest.Mock;
    diff: jest.Mock;
  };

  beforeEach(async () => {
    usersRepository = {
      findById: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      remove: jest.fn(),
    };
    auditLogService = {
      log: jest.fn().mockResolvedValue(undefined),
      getUserLabel: jest.fn().mockResolvedValue('Admin Beispiel'),
      diff: jest.fn().mockReturnValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: UserRepository, useValue: usersRepository },
        { provide: AuditLogService, useValue: auditLogService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('logs USER_ACTIVATED when status changes from pending to active', async () => {
    usersRepository.findById.mockResolvedValue({
      id: 7,
      firstName: 'Max',
      lastName: 'Mustermann',
      email: 'max@example.com',
      status: { id: StatusEnum.pending },
      role: { id: RoleEnum.user },
    });
    usersRepository.update.mockResolvedValue({
      id: 7,
      firstName: 'Max',
      lastName: 'Mustermann',
      status: { id: StatusEnum.active },
      role: { id: RoleEnum.user },
    });

    await service.update(
      7,
      { status: { id: StatusEnum.active } } as any,
      { id: 1, role: { id: RoleEnum.admin } } as any,
    );

    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.USER_ACTIVATED,
        entityId: 7,
      }),
    );
  });

  it('logs ROLE_CHANGED when the roleId changes', async () => {
    usersRepository.findById.mockResolvedValue({
      id: 8,
      firstName: 'Erika',
      lastName: 'Musterfrau',
      email: 'erika@example.com',
      status: { id: StatusEnum.active },
      role: { id: RoleEnum.user },
    });
    usersRepository.update.mockResolvedValue({
      id: 8,
      firstName: 'Erika',
      lastName: 'Musterfrau',
      status: { id: StatusEnum.active },
      role: { id: RoleEnum.verwaltung },
    });

    await service.update(
      8,
      { role: { id: RoleEnum.verwaltung } } as any,
      { id: 1, role: { id: RoleEnum.admin } } as any,
    );

    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.ROLE_CHANGED,
        entityId: 8,
        changes: {
          role: { old: RoleEnum.user, new: RoleEnum.verwaltung },
        },
      }),
    );
  });

  it('falls back to a generic UPDATE for other field changes', async () => {
    usersRepository.findById.mockResolvedValue({
      id: 9,
      firstName: 'Old',
      lastName: 'Name',
      status: { id: StatusEnum.active },
      role: { id: RoleEnum.user },
    });
    usersRepository.update.mockResolvedValue({
      id: 9,
      firstName: 'New',
      lastName: 'Name',
      status: { id: StatusEnum.active },
      role: { id: RoleEnum.user },
    });

    await service.update(
      9,
      { firstName: 'New' } as any,
      { id: 1, role: { id: RoleEnum.admin } } as any,
    );

    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: AuditAction.UPDATE, entityId: 9 }),
    );
  });
});
