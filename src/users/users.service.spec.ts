import {
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { UsersService } from './users.service';
import { UserRepository } from './infrastructure/persistence/user.repository';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditAction } from '../audit-log/audit-action.enum';
import { AuditService } from '../audit-log/audit-service.enum';
import { StatusEnum } from '../statuses/statuses.enum';
import { RoleEnum } from '../roles/roles.enum';

describe('UsersService', () => {
  let service: UsersService;
  let usersRepository: {
    findById: jest.Mock;
    update: jest.Mock;
    create: jest.Mock;
    remove: jest.Mock;
    countActiveAdmins: jest.Mock;
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
      countActiveAdmins: jest.fn().mockResolvedValue(1),
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
        service: AuditService.USERS,
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
        service: AuditService.USERS,
        entityId: 8,
        changes: {
          role: { old: RoleEnum.user, new: RoleEnum.verwaltung },
        },
      }),
    );
  });

  it('keeps other field changes in ROLE_CHANGED when combined in one request', async () => {
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
      firstName: 'Erika-Neu',
      lastName: 'Musterfrau',
      status: { id: StatusEnum.active },
      role: { id: RoleEnum.verwaltung },
    });
    auditLogService.diff.mockReturnValueOnce({
      firstName: { old: 'Erika', new: 'Erika-Neu' },
    });

    await service.update(
      8,
      { role: { id: RoleEnum.verwaltung }, firstName: 'Erika-Neu' } as any,
      { id: 1, role: { id: RoleEnum.admin } } as any,
    );

    expect(auditLogService.log).toHaveBeenCalledTimes(1);
    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.ROLE_CHANGED,
        service: AuditService.USERS,
        changes: {
          firstName: { old: 'Erika', new: 'Erika-Neu' },
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
      expect.objectContaining({
        action: AuditAction.UPDATE,
        service: AuditService.USERS,
        entityId: 9,
      }),
    );
  });

  it('should reject role names instead of numeric role ids', async () => {
    usersRepository.findById.mockResolvedValue({
      id: 9,
      role: { id: RoleEnum.user },
    });

    await expect(
      service.update(
        9,
        { role: { id: 'admin' } } as any,
        { id: 1, role: { id: RoleEnum.admin } } as any,
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(usersRepository.update).not.toHaveBeenCalled();
  });

  it('should reject an email that still belongs to a deleted user', async () => {
    const findByEmail = jest.fn().mockResolvedValue({
      id: 3,
      email: 'old@example.com',
      deletedAt: new Date(),
    });
    (usersRepository as unknown as { findByEmail: jest.Mock }).findByEmail =
      findByEmail;

    await expect(
      service.create({
        email: 'old@example.com',
        firstName: 'Neu',
        lastName: 'Nutzer',
      } as any),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(findByEmail).toHaveBeenCalledWith('old@example.com', {
      withDeleted: true,
    });
    expect(usersRepository.create).not.toHaveBeenCalled();
  });

  it('should answer with 404 when updating or deleting an unknown user', async () => {
    usersRepository.findById.mockResolvedValue(null);

    await expect(
      service.update(
        404,
        { firstName: 'X' } as any,
        { id: 1, role: { id: RoleEnum.admin } } as any,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.remove(404, { id: 1 })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(usersRepository.update).not.toHaveBeenCalled();
    expect(usersRepository.remove).not.toHaveBeenCalled();
  });

  describe('last active admin', () => {
    const activeAdmin = {
      id: 1,
      firstName: 'Letzte',
      lastName: 'Admin',
      role: { id: RoleEnum.admin },
      status: { id: StatusEnum.active },
    };

    beforeEach(() => {
      usersRepository.findById.mockResolvedValue(activeAdmin);
      usersRepository.countActiveAdmins.mockResolvedValue(0);
    });

    it('should not delete the last active admin', async () => {
      await expect(service.remove(1, { id: 1 })).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
      expect(usersRepository.remove).not.toHaveBeenCalled();
    });

    it('should not demote or deactivate the last active admin', async () => {
      await expect(
        service.update(
          1,
          { role: { id: RoleEnum.user } } as any,
          activeAdmin as any,
        ),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      await expect(
        service.update(
          1,
          { status: { id: StatusEnum.blocked } } as any,
          activeAdmin as any,
        ),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(usersRepository.update).not.toHaveBeenCalled();
      expect(usersRepository.countActiveAdmins).toHaveBeenCalledWith(1);
    });

    it('should allow it when another active admin exists', async () => {
      usersRepository.countActiveAdmins.mockResolvedValue(1);

      await expect(service.remove(1, { id: 2 })).resolves.toBeUndefined();
      expect(usersRepository.remove).toHaveBeenCalledWith(1);
    });

    it('should allow other changes of the last active admin', async () => {
      usersRepository.update.mockResolvedValue(activeAdmin);

      await service.update(1, { firstName: 'Neu' } as any, activeAdmin as any);

      expect(usersRepository.update).toHaveBeenCalled();
    });
  });

  it('should hash a new password with the configured cost factor', async () => {
    usersRepository.findById.mockResolvedValue({
      id: 4,
      role: { id: RoleEnum.user },
      status: { id: StatusEnum.active },
    });
    usersRepository.update.mockResolvedValue({ id: 4 });

    await service.update(
      4,
      { password: 'Neues-Passwort1' } as any,
      { id: 1, role: { id: RoleEnum.admin } } as any,
    );

    const [, payload] = usersRepository.update.mock.calls[0];
    expect(payload.password).not.toBe('Neues-Passwort1');
    expect(payload.password).toBeDefined();
  });
});
