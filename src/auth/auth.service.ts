import {
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import ms from 'ms';
import crypto from 'crypto';
import { randomStringGenerator } from '@nestjs/common/utils/random-string-generator.util';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { AuthEmailLoginDto } from './dto/auth-email-login.dto';
import { AuthUpdateDto } from './dto/auth-update.dto';
import { AuthRegisterLoginDto } from './dto/auth-register-login.dto';
import { NullableType } from '../utils/types/nullable.type';
import { LoginResponseDto } from './dto/login-response.dto';
import { ConfigService, ConfigType } from '@nestjs/config';
import { JwtRefreshPayloadType } from './strategies/types/jwt-refresh-payload.type';
import { JwtPayloadType } from './strategies/types/jwt-payload.type';
import { UsersService } from '../users/users.service';
import { AllConfigType } from '../config/config.type';
import { MailService } from '../mail/mail.service';
import { RoleEnum } from '../roles/roles.enum';
import { Session } from '../session/domain/session';
import { SessionService } from '../session/session.service';
import { StatusEnum } from '../statuses/statuses.enum';
import { User } from '../users/domain/user';
//import { I18nService } from 'nestjs-i18n';
import { t } from '../utils/i18n-errors';
import authConfig from './config/auth.config';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditAction } from '../audit-log/audit-action.enum';
import { AuditEntityType } from '../audit-log/audit-entity-type.enum';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private usersService: UsersService,
    private sessionService: SessionService,
    private mailService: MailService,
    private configService: ConfigService<AllConfigType, true>,
    @Inject(authConfig.KEY)
    private readonly authConfiguration: ConfigType<typeof authConfig>,
    //private readonly i18n: I18nService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async validateLogin(
    loginDto: AuthEmailLoginDto,
    ip?: string,
    userAgent?: string,
  ): Promise<LoginResponseDto> {
    try {
      const user = await this.usersService.findByEmail(loginDto.email);

      if (!user) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            email: t('validation.errors.userNotFound'),
          },
        });
      }

      if (!user.password) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            password: t('validation.errors.incorrectPassword'),
          },
        });
      }

      const isValidPassword = await bcrypt.compare(
        loginDto.password,
        user.password,
      );

      if (!isValidPassword) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            password: t('validation.errors.incorrectPassword'),
          },
        });
      }

      if (user.status?.id !== StatusEnum.active) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            password: t('validation.errors.userNotApproved'),
          },
        });
      }

      const hash = crypto
        .createHash('sha256')
        .update(randomStringGenerator())
        .digest('hex');

      const session = await this.sessionService.create({
        user,
        hash,
      });

      const { token, refreshToken, tokenExpires } = await this.getTokensData({
        id: user.id,
        role: user.role,
        sessionId: session.id,
        hash,
      });

      const userLabel = await this.auditLogService.getUserLabel({
        id: Number(user.id),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      });
      await this.auditLogService.log({
        user: { id: Number(user.id) },
        userLabel,
        action: AuditAction.LOGIN,
        entityType: AuditEntityType.AUTH,
        entityId: user.id,
        summary: `${userLabel} hat sich erfolgreich angemeldet`,
        ip,
        userAgent,
      });

      return {
        refreshToken,
        token,
        tokenExpires,
        user,
      };
    } catch (error) {
      if (error instanceof UnprocessableEntityException) {
        // Aus Sicherheitsgründen niemals Passwort/Hash loggen, nur die
        // versuchte E-Mail-Adresse.
        await this.auditLogService.log({
          user: null,
          action: AuditAction.LOGIN_FAILED,
          entityType: AuditEntityType.AUTH,
          entityId: null,
          summary: `Fehlgeschlagener Login-Versuch für "${loginDto.email}"`,
          ip,
          userAgent,
        });
      }

      throw error;
    }
  }

  async register(dto: AuthRegisterLoginDto): Promise<void> {
    const user = await this.usersService.create({
      ...dto,
      email: dto.email,
      role: {
        id: RoleEnum.user,
      },
      status: {
        id: StatusEnum.inactive,
      },
    });

    const userLabel = await this.auditLogService.getUserLabel({
      id: Number(user.id),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    });
    await this.auditLogService.log({
      user: { id: Number(user.id) },
      userLabel,
      action: AuditAction.REGISTERED,
      entityType: AuditEntityType.AUTH,
      entityId: user.id,
      summary: `${userLabel} hat sich registriert`,
    });

    const hash = await this.jwtService.signAsync(
      {
        confirmEmailUserId: user.id,
      },
      {
        secret: this.authConfiguration.confirmEmailSecret,
        expiresIn: this.authConfiguration.confirmEmailExpires,
      },
    );

    await this.mailService.userSignUp({
      to: dto.email,
      data: {
        hash,
      },
      userName: user.firstName,
    });
  }

  async confirmEmail(hash: string): Promise<void> {
    let userId: User['id'];

    try {
      const jwtData = await this.jwtService.verifyAsync<{
        confirmEmailUserId: User['id'];
      }>(hash, {
        secret: this.authConfiguration.confirmEmailSecret,
      });

      userId = jwtData.confirmEmailUserId;
    } catch {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          hash: `invalidHash`,
        },
      });
    }

    const user = await this.usersService.findById(userId);

    if (
      !user ||
      user?.status?.id?.toString() !== StatusEnum.inactive.toString()
    ) {
      throw new NotFoundException({
        status: HttpStatus.NOT_FOUND,
        error: `notFound`,
      });
    }

    user.status = {
      id: StatusEnum.pending,
    };

    await this.usersService.update(user.id, user, user);
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          email: 'emailNotExists',
        },
      });
    }

    const tokenExpiresIn = this.authConfiguration.forgotExpires;

    const tokenExpires = Date.now() + ms(tokenExpiresIn);

    const hash = await this.jwtService.signAsync(
      {
        forgotUserId: user.id,
      },
      {
        secret: this.authConfiguration.forgotSecret,
        expiresIn: tokenExpiresIn,
      },
    );

    await this.mailService.forgotPassword({
      to: email,
      data: {
        hash,
        tokenExpires,
      },
      userName: user.firstName,
    });

    const userLabel = await this.auditLogService.getUserLabel({
      id: Number(user.id),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    });
    await this.auditLogService.log({
      user: { id: Number(user.id) },
      userLabel,
      action: AuditAction.PASSWORD_RESET_REQUESTED,
      entityType: AuditEntityType.AUTH,
      entityId: user.id,
      summary: `${userLabel} hat einen Passwort-Reset angefordert`,
    });
  }

  async resetPassword(hash: string, password: string): Promise<void> {
    let userId: User['id'];

    try {
      const jwtData = await this.jwtService.verifyAsync<{
        forgotUserId: User['id'];
      }>(hash, {
        secret: this.authConfiguration.forgotSecret,
      });

      userId = jwtData.forgotUserId;
    } catch {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          hash: `invalidHash`,
        },
      });
    }

    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          hash: `notFound`,
        },
      });
    }

    user.password = password;

    await this.sessionService.deleteByUserId({
      userId: user.id,
    });

    await this.usersService.update(user.id, user, user);

    const userLabel = await this.auditLogService.getUserLabel({
      id: Number(user.id),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    });
    await this.auditLogService.log({
      user: { id: Number(user.id) },
      userLabel,
      action: AuditAction.PASSWORD_CHANGED,
      entityType: AuditEntityType.AUTH,
      entityId: user.id,
      summary: `${userLabel} hat das Passwort per Reset-Link geändert`,
    });
  }

  async me(userJwtPayload: JwtPayloadType): Promise<NullableType<User>> {
    return this.usersService.findById(userJwtPayload.id);
  }

  async update(
    userJwtPayload: JwtPayloadType,
    userDto: AuthUpdateDto,
  ): Promise<NullableType<User>> {
    const currentUser = await this.usersService.findById(userJwtPayload.id);

    if (!currentUser) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          user: 'userNotFound',
        },
      });
    }

    if (userDto.password) {
      if (!userDto.oldPassword) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            oldPassword: 'missingOldPassword',
          },
        });
      }

      if (!currentUser.password) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            oldPassword: 'incorrectOldPassword',
          },
        });
      }

      const isValidOldPassword = await bcrypt.compare(
        userDto.oldPassword,
        currentUser.password,
      );

      if (!isValidOldPassword) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            oldPassword: 'incorrectOldPassword',
          },
        });
      } else {
        await this.sessionService.deleteByUserIdWithExclude({
          userId: currentUser.id,
          excludeSessionId: userJwtPayload.sessionId,
        });
      }
    }

    if (userDto.email && userDto.email !== currentUser.email) {
      const userByEmail = await this.usersService.findByEmail(userDto.email);

      if (userByEmail && userByEmail.id !== currentUser.id) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            email: 'emailExists',
          },
        });
      }
    }

    const passwordChanged = Boolean(userDto.password);

    delete userDto.email;
    delete userDto.oldPassword;

    await this.usersService.update(userJwtPayload.id, userDto, currentUser);

    if (passwordChanged) {
      const userLabel = await this.auditLogService.getUserLabel({
        id: Number(currentUser.id),
        email: currentUser.email,
        firstName: currentUser.firstName,
        lastName: currentUser.lastName,
      });
      await this.auditLogService.log({
        user: { id: Number(currentUser.id) },
        userLabel,
        action: AuditAction.PASSWORD_CHANGED,
        entityType: AuditEntityType.AUTH,
        entityId: currentUser.id,
        summary: `${userLabel} hat das Passwort geändert`,
      });
    }

    return this.usersService.findById(userJwtPayload.id);
  }

  async refreshToken(
    data: Pick<JwtRefreshPayloadType, 'sessionId' | 'hash'>,
  ): Promise<Omit<LoginResponseDto, 'user'>> {
    const session = await this.sessionService.findById(data.sessionId);

    if (!session) {
      throw new UnauthorizedException();
    }

    if (session.hash !== data.hash) {
      throw new UnauthorizedException();
    }

    const hash = crypto
      .createHash('sha256')
      .update(randomStringGenerator())
      .digest('hex');

    const user = await this.usersService.findById(session.user.id);

    if (!user?.role) {
      throw new UnauthorizedException();
    }

    await this.sessionService.update(session.id, {
      hash,
    });

    const { token, refreshToken, tokenExpires } = await this.getTokensData({
      id: session.user.id,
      role: {
        id: user.role.id,
      },
      sessionId: session.id,
      hash,
    });

    return {
      token,
      refreshToken,
      tokenExpires,
    };
  }

  async softDelete(user: User): Promise<void> {
    await this.usersService.remove(user.id, { id: Number(user.id) });
  }

  async logout(
    data: Pick<JwtRefreshPayloadType, 'sessionId'> & { userId?: User['id'] },
  ) {
    const result = await this.sessionService.deleteById(data.sessionId);

    if (data.userId) {
      const userLabel = await this.auditLogService.getUserLabel({
        id: Number(data.userId),
      });
      await this.auditLogService.log({
        user: { id: Number(data.userId) },
        userLabel,
        action: AuditAction.LOGOUT,
        entityType: AuditEntityType.AUTH,
        entityId: data.userId,
        summary: `${userLabel} hat sich abgemeldet`,
      });
    }

    return result;
  }

  private async getTokensData(data: {
    id: User['id'];
    role: User['role'];
    sessionId: Session['id'];
    hash: Session['hash'];
  }) {
    const tokenExpiresIn = this.authConfiguration.expires;

    const tokenExpires = Date.now() + ms(tokenExpiresIn);

    const [token, refreshToken] = await Promise.all([
      await this.jwtService.signAsync(
        {
          id: data.id,
          role: data.role,
          sessionId: data.sessionId,
        },
        {
          secret: this.authConfiguration.secret,
          expiresIn: tokenExpiresIn,
        },
      ),
      await this.jwtService.signAsync(
        {
          sessionId: data.sessionId,
          hash: data.hash,
        },
        {
          secret: this.authConfiguration.refreshSecret,
          expiresIn: this.authConfiguration.refreshExpires,
        },
      ),
    ]);

    return {
      token,
      refreshToken,
      tokenExpires,
    };
  }
}
