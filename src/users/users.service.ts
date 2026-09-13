import {
  HttpStatus,
  Injectable,
  UnprocessableEntityException,
  ForbiddenException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { NullableType } from '../utils/types/nullable.type';
import { FilterUserDto, SortUserDto } from './dto/query-user.dto';
import { UserRepository } from './infrastructure/persistence/user.repository';
import { User } from './domain/user';
import bcrypt from 'bcryptjs';
import { AuthProvidersEnum } from '../auth/auth-providers.enum';
import { RoleEnum } from '../roles/roles.enum';
import { StatusEnum } from '../statuses/statuses.enum';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { Role } from '../roles/domain/role';
import { Status } from '../statuses/domain/status';
import { UpdateUserDto } from './dto/update-user.dto';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditAction } from '../audit-log/audit-action.enum';
import { AuditEntityType } from '../audit-log/audit-entity-type.enum';

function userDisplayLabel(user: {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  id: User['id'];
}): string {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ');
  return fullName || user.email || `User #${user.id}`;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UserRepository,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * @param actingUser Der ausführende Admin/Verwaltung. Fehlt bei
   * Selbstregistrierung (auth.service.ts#register loggt dort separat
   * REGISTERED, um Doppel-Einträge zu vermeiden).
   */
  async create(
    createUserDto: CreateUserDto,
    actingUser?: { id: number } | null,
  ): Promise<User> {
    // Do not remove comment below.
    // <creating-property />

    let password: string | undefined = undefined;

    if (createUserDto.password) {
      const salt = await bcrypt.genSalt();
      password = await bcrypt.hash(createUserDto.password, salt);
    }

    let email: string | null = null;

    if (createUserDto.email) {
      const userObject = await this.usersRepository.findByEmail(
        createUserDto.email,
      );
      if (userObject) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            email: 'emailAlreadyExists',
          },
        });
      }
      email = createUserDto.email;
    }

    let role: Role | undefined = undefined;

    if (createUserDto.role?.id) {
      const roleObject = Object.values(RoleEnum)
        .map(String)
        .includes(String(createUserDto.role.id));
      if (!roleObject) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            role: 'roleNotExists',
          },
        });
      }

      role = {
        id: createUserDto.role.id,
      };
    }

    let status: Status | undefined = undefined;

    if (createUserDto.status?.id) {
      const statusObject = Object.values(StatusEnum)
        .map(String)
        .includes(String(createUserDto.status.id));
      if (!statusObject) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            status: 'statusNotExists',
          },
        });
      }

      status = {
        id: createUserDto.status.id,
      };
    }

    const created = await this.usersRepository.create({
      // Do not remove comment below.
      // <creating-property-payload />
      firstName: createUserDto.firstName,
      lastName: createUserDto.lastName,
      email: email,
      password: password,
      role: role,
      status: status,
      provider: createUserDto.provider ?? AuthProvidersEnum.email,
      socialId: createUserDto.socialId,
    });

    if (actingUser) {
      const userLabel = await this.auditLogService.getUserLabel({
        id: actingUser.id,
      });
      await this.auditLogService.log({
        user: { id: actingUser.id },
        userLabel,
        action: AuditAction.CREATE,
        entityType: AuditEntityType.USER,
        entityId: created.id,
        summary: `${userLabel} hat Nutzer "${userDisplayLabel(created)}" angelegt`,
      });
    }

    return created;
  }

  findManyWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterUserDto | null;
    sortOptions?: SortUserDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<User[]> {
    return this.usersRepository.findManyWithPagination({
      filterOptions,
      sortOptions,
      paginationOptions,
    });
  }

  findById(id: User['id']): Promise<NullableType<User>> {
    return this.usersRepository.findById(id);
  }

  findByIds(ids: User['id'][]): Promise<User[]> {
    return this.usersRepository.findByIds(ids);
  }

  findByEmail(email: User['email']): Promise<NullableType<User>> {
    return this.usersRepository.findByEmail(email);
  }

  findBySocialIdAndProvider({
    socialId,
    provider,
  }: {
    socialId: User['socialId'];
    provider: User['provider'];
  }): Promise<NullableType<User>> {
    return this.usersRepository.findBySocialIdAndProvider({
      socialId,
      provider,
    });
  }

  async update(
    id: User['id'],
    updateUserDto: UpdateUserDto,
    currentUser: User,
  ): Promise<User | null> {
    // Do not remove comment below.
    // <updating-property />

    const beforeUser = await this.usersRepository.findById(id);

    let password: string | undefined = undefined;

    if (updateUserDto.password) {
      if (beforeUser && beforeUser?.password !== updateUserDto.password) {
        const salt = await bcrypt.genSalt();
        password = await bcrypt.hash(updateUserDto.password, salt);
      }
    }

    let email: string | null | undefined = undefined;

    if (updateUserDto.email) {
      const userObject = await this.usersRepository.findByEmail(
        updateUserDto.email,
      );

      if (userObject && userObject.id !== id) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            email: 'emailAlreadyExists',
          },
        });
      }

      email = updateUserDto.email;
    } else if (updateUserDto.email === null) {
      email = null;
    }

    let role: Role | undefined = undefined;

    if (updateUserDto.role?.id) {
      const roleObject = Object.values(RoleEnum)
        .map(String)
        .includes(String(updateUserDto.role.id));
      if (!roleObject) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            role: 'roleNotExists',
          },
        });
      }

      // Verwaltung darf keine Admin-Rolle vergeben.
      if (
        currentUser.role?.id === RoleEnum.verwaltung &&
        updateUserDto.role?.id === RoleEnum.admin
      ) {
        throw new ForbiddenException(
          'Benutzer mit der Rolle Verwaltung dürfen keine Admin-Rolle vergeben.',
        );
      }

      role = {
        id: updateUserDto.role.id,
      };
    }

    let status: Status | undefined = undefined;

    if (updateUserDto.status?.id) {
      const statusObject = Object.values(StatusEnum)
        .map(String)
        .includes(String(updateUserDto.status.id));
      if (!statusObject) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            status: 'statusNotExists',
          },
        });
      }

      status = {
        id: updateUserDto.status.id,
      };
    }

    const updated = await this.usersRepository.update(id, {
      // Do not remove comment below.
      // <updating-property-payload />
      firstName: updateUserDto.firstName,
      lastName: updateUserDto.lastName,
      email,
      password,
      role,
      status,
      provider: updateUserDto.provider,
      socialId: updateUserDto.socialId,
    });

    await this.logUserUpdate(
      id,
      beforeUser,
      updateUserDto,
      currentUser,
      updated,
    );

    return updated;
  }

  private async logUserUpdate(
    id: User['id'],
    beforeUser: NullableType<User>,
    updateUserDto: UpdateUserDto,
    currentUser: User,
    updated: NullableType<User>,
  ): Promise<void> {
    const actingUserId = Number(currentUser.id);
    const actingLabel = await this.auditLogService.getUserLabel({
      id: actingUserId,
    });
    const targetSource = updated ?? beforeUser;
    const targetLabel = targetSource
      ? userDisplayLabel({ ...targetSource, id })
      : `User #${id}`;

    const wasNotActive =
      beforeUser?.status?.id === StatusEnum.pending ||
      beforeUser?.status?.id === StatusEnum.inactive;
    const activatedNow =
      wasNotActive && updateUserDto.status?.id === StatusEnum.active;

    const roleChanged =
      updateUserDto.role?.id !== undefined &&
      String(beforeUser?.role?.id) !== String(updateUserDto.role.id);

    // Vollständiger Diff aller übermittelten Felder - wird an jede Meldung
    // angehängt, damit bei kombinierten Änderungen (z.B. Rollenwechsel und
    // Namensänderung in einem Request) nichts aus dem Audit-Trail verloren
    // geht, selbst wenn zusätzlich USER_ACTIVATED/ROLE_CHANGED greifen.
    const changes = this.auditLogService.diff(
      (beforeUser ?? {}) as Record<string, unknown>,
      updateUserDto as Record<string, unknown>,
    );

    let loggedSpecialAction = false;

    if (activatedNow) {
      loggedSpecialAction = true;
      await this.auditLogService.log({
        user: { id: actingUserId },
        userLabel: actingLabel,
        action: AuditAction.USER_ACTIVATED,
        entityType: AuditEntityType.USER,
        entityId: id,
        summary: `${actingLabel} hat Nutzer "${targetLabel}" freigeschaltet`,
        changes,
      });
    }

    if (roleChanged) {
      loggedSpecialAction = true;
      const oldRoleName = beforeUser?.role?.id
        ? (RoleEnum[beforeUser.role.id] ?? String(beforeUser.role.id))
        : 'unbekannt';
      const newRoleName =
        RoleEnum[updateUserDto.role!.id as number] ??
        String(updateUserDto.role!.id);

      await this.auditLogService.log({
        user: { id: actingUserId },
        userLabel: actingLabel,
        action: AuditAction.ROLE_CHANGED,
        entityType: AuditEntityType.USER,
        entityId: id,
        summary: `${actingLabel} hat die Berechtigung von "${targetLabel}" von ${oldRoleName} zu ${newRoleName} geändert`,
        changes: {
          ...changes,
          role: {
            old: beforeUser?.role?.id ?? null,
            new: updateUserDto.role!.id,
          },
        },
      });
    }

    if (!loggedSpecialAction) {
      await this.auditLogService.log({
        user: { id: actingUserId },
        userLabel: actingLabel,
        action: AuditAction.UPDATE,
        entityType: AuditEntityType.USER,
        entityId: id,
        summary: `${actingLabel} hat Nutzer "${targetLabel}" bearbeitet`,
        changes,
      });
    }
  }

  async remove(
    id: User['id'],
    actingUser?: { id: number } | null,
  ): Promise<void> {
    const target = await this.usersRepository.findById(id);

    await this.usersRepository.remove(id);

    if (actingUser) {
      const actingLabel = await this.auditLogService.getUserLabel({
        id: actingUser.id,
      });
      const targetLabel = target
        ? userDisplayLabel({ ...target, id })
        : `User #${id}`;

      await this.auditLogService.log({
        user: { id: actingUser.id },
        userLabel: actingLabel,
        action: AuditAction.DELETE,
        entityType: AuditEntityType.USER,
        entityId: id,
        summary: `${actingLabel} hat Nutzer "${targetLabel}" deaktiviert (Soft-Delete)`,
      });
    }
  }
}
