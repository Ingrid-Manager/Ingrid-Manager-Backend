import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnprocessableEntityException } from '@nestjs/common';
import bcrypt from 'bcryptjs';

import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { SessionService } from '../session/session.service';
import { MailService } from '../mail/mail.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditAction } from '../audit-log/audit-action.enum';
import { AuditEntityType } from '../audit-log/audit-entity-type.enum';
import authConfig from './config/auth.config';
import { StatusEnum } from '../statuses/statuses.enum';
import { RoleEnum } from '../roles/roles.enum';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: {
    findByEmail: jest.Mock;
    create: jest.Mock;
    findById: jest.Mock;
  };
  let auditLogService: {
    log: jest.Mock;
    getUserLabel: jest.Mock;
    diff: jest.Mock;
  };

  beforeEach(async () => {
    usersService = {
      findByEmail: jest.fn(),
      create: jest.fn(),
      findById: jest.fn(),
    };
    auditLogService = {
      log: jest.fn().mockResolvedValue(undefined),
      getUserLabel: jest.fn().mockResolvedValue('Anna Beispiel'),
      diff: jest.fn().mockReturnValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        {
          provide: SessionService,
          useValue: { create: jest.fn().mockResolvedValue({ id: 1 }) },
        },
        {
          provide: MailService,
          useValue: {
            userSignUp: jest.fn().mockResolvedValue(undefined),
            forgotPassword: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: JwtService,
          useValue: { signAsync: jest.fn().mockResolvedValue('signed-token') },
        },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        {
          provide: authConfig.KEY,
          useValue: {
            secret: 'secret',
            expires: '1h',
            refreshSecret: 'refresh-secret',
            refreshExpires: '1h',
            forgotSecret: 'forgot-secret',
            forgotExpires: '1h',
            confirmEmailSecret: 'confirm-secret',
            confirmEmailExpires: '1h',
          },
        },
        { provide: AuditLogService, useValue: auditLogService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('logs a LOGIN entry on successful login', async () => {
    const passwordHash = await bcrypt.hash('super-secret-pw', 4);
    usersService.findByEmail.mockResolvedValue({
      id: 1,
      email: 'anna@example.com',
      firstName: 'Anna',
      lastName: 'Beispiel',
      password: passwordHash,
      status: { id: StatusEnum.active },
      role: { id: RoleEnum.user },
    });

    await service.validateLogin(
      { email: 'anna@example.com', password: 'super-secret-pw' } as any,
      '127.0.0.1',
      'jest-agent',
    );

    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.LOGIN,
        entityType: AuditEntityType.AUTH,
        ip: '127.0.0.1',
        userAgent: 'jest-agent',
      }),
    );
  });

  it('logs a LOGIN_FAILED entry without the password on wrong credentials', async () => {
    usersService.findByEmail.mockResolvedValue(null);

    await expect(
      service.validateLogin({
        email: 'unknown@example.com',
        password: 'super-secret-pw',
      } as any),
    ).rejects.toThrow(UnprocessableEntityException);

    expect(auditLogService.log).toHaveBeenCalledTimes(1);
    const loggedEntry = auditLogService.log.mock.calls[0][0];

    expect(loggedEntry.action).toBe(AuditAction.LOGIN_FAILED);
    expect(loggedEntry.user).toBeNull();
    expect(loggedEntry.summary).toContain('unknown@example.com');
    expect(JSON.stringify(loggedEntry)).not.toContain('super-secret-pw');
  });

  it('logs a REGISTERED entry after successful registration', async () => {
    usersService.create.mockResolvedValue({
      id: 5,
      email: 'new@example.com',
      firstName: 'New',
      lastName: 'User',
    });

    await service.register({
      email: 'new@example.com',
      password: 'super-secret-pw',
      firstName: 'New',
      lastName: 'User',
    } as any);

    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.REGISTERED,
        entityType: AuditEntityType.AUTH,
        entityId: 5,
      }),
    );
  });
});
