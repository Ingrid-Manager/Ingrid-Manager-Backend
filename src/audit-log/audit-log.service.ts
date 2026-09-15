import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AuditLog } from './infrastructure/relational/persistence/entities/audit-log.entity';
import { UserEntity } from '../users/infrastructure/persistence/relational/entities/user.entity';
import { AuditAction } from './audit-action.enum';
import { AuditService } from './audit-service.enum';
import { AuditLogFilterDto } from './application/dto/audit-log-filter.dto';

export interface AuditLogUser {
  id: number;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}

export interface AuditLogParams {
  user: AuditLogUser | null;
  action: AuditAction;
  /** Fachliches Modul, dem diese Aktion zuzuordnen ist (für die Filterleiste im Admin-Frontend). */
  service: AuditService;
  entityType: string;
  entityId: number | string | null;
  summary: string;
  changes?: Record<string, { old: unknown; new: unknown }>;
  ip?: string;
  userAgent?: string;
  /**
   * Bereits aufgelöster Anzeigename, z.B. weil der Aufrufer ihn schon per
   * getUserLabel() für den summary-Text ermittelt hat. Erspart eine erneute
   * Nachlade-Abfrage. Wird nicht angegeben, löst log() den Namen selbst auf.
   */
  userLabel?: string;
}

const DEFAULT_IGNORED_DIFF_FIELDS = [
  'id',
  'createdAt',
  'updatedAt',
  'deletedAt',
  'password',
  'hash',
  'salt',
  'refreshToken',
];

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly repo: Repository<AuditLog>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  async log(params: AuditLogParams): Promise<void> {
    try {
      const userLabel = params.userLabel ?? (await this.getUserLabel(params.user));

      const entry = this.repo.create({
        userId: params.user?.id ?? null,
        userLabel,
        action: params.action,
        service: params.service,
        entityType: params.entityType,
        entityId:
          params.entityId === null || params.entityId === undefined
            ? null
            : String(params.entityId),
        summary: params.summary,
        changes: params.changes ?? null,
        ip: params.ip ?? null,
        userAgent: params.userAgent ?? null,
      });

      await this.repo.save(entry);
    } catch (error) {
      // Audit-Logging darf die eigentliche Aktion nie zum Scheitern bringen.
      this.logger.error(
        `Audit-Log-Eintrag konnte nicht gespeichert werden: ${(error as Error).message}`,
        (error as Error).stack,
      );
    }
  }

  /**
   * Vergleicht zwei Objekte und liefert nur die Felder zurück, die sich
   * tatsächlich unterscheiden (per JSON.stringify-Vergleich). `before`/`after`
   * bewusst als Record<string, unknown> statt generisch <T>, damit beliebige
   * Entity-/DTO-Objekte ohne Type-Gymnastik an den Aufrufstellen übergeben
   * werden können.
   */
  diff(
    before: Record<string, unknown> | null | undefined,
    after: Record<string, unknown>,
    ignoreFields: string[] = [],
  ): Record<string, { old: unknown; new: unknown }> {
    const ignored = new Set([...DEFAULT_IGNORED_DIFF_FIELDS, ...ignoreFields]);
    const changes: Record<string, { old: unknown; new: unknown }> = {};

    for (const key of Object.keys(after)) {
      if (ignored.has(key)) {
        continue;
      }

      const oldValue = before?.[key];
      const newValue = after[key];

      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changes[key] = { old: oldValue, new: newValue };
      }
    }

    return changes;
  }

  async findAll(filter: AuditLogFilterDto) {
    const page = filter.page ?? 1;
    const limit = Math.min(filter.limit ?? 25, 100);

    const qb = this.repo
      .createQueryBuilder('log')
      .orderBy('log.createdAt', 'DESC');

    if (filter.userId) {
      qb.andWhere('log.userId = :userId', { userId: filter.userId });
    }

    if (filter.service) {
      qb.andWhere('log.service = :service', { service: filter.service });
    }

    if (filter.entityType) {
      qb.andWhere('log.entityType = :entityType', {
        entityType: filter.entityType,
      });
    }

    if (filter.entityId) {
      qb.andWhere('log.entityId = :entityId', { entityId: filter.entityId });
    }

    if (filter.action) {
      qb.andWhere('log.action = :action', { action: filter.action });
    }

    if (filter.from) {
      qb.andWhere('log.createdAt >= :from', { from: new Date(filter.from) });
    }

    if (filter.to) {
      qb.andWhere('log.createdAt <= :to', { to: new Date(filter.to) });
    }

    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findForEntity(entityType: string, entityId: string): Promise<AuditLog[]> {
    return this.repo.find({
      where: { entityType, entityId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Löst den Anzeigenamen eines Users auf (für summary-Texte oder den
   * userLabel-Fallback im Log-Eintrag). Lädt bei Bedarf (nur userId bekannt)
   * per withDeleted:true nach, damit auch soft-gelöschte User aufgelöst werden.
   *
   * Wirft NIE - Aufrufer verwenden das Ergebnis meist direkt im summary-Text
   * der eigentlichen Aktion (Termin anlegen, User bearbeiten, ...), die durch
   * einen Fehler beim Nachladen des Anzeigenamens nicht scheitern darf.
   */
  async getUserLabel(user: AuditLogUser | null): Promise<string> {
    if (!user) {
      return 'System';
    }

    try {
      let { firstName, lastName, email } = user;

      const nameInfoProvided =
        firstName !== undefined ||
        lastName !== undefined ||
        email !== undefined;

      if (!nameInfoProvided) {
        // Nur die userId ist bekannt: Anzeigedaten nachladen. withDeleted, da
        // User niemals hart gelöscht, sondern nur per softDelete deaktiviert werden.
        const entity = await this.userRepo.findOne({
          where: { id: user.id },
          withDeleted: true,
        });

        firstName = entity?.firstName ?? null;
        lastName = entity?.lastName ?? null;
        email = entity?.email ?? null;
      }

      const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();

      if (fullName) {
        return fullName;
      }

      if (email) {
        return email;
      }

      return `User #${user.id}`;
    } catch (error) {
      this.logger.error(
        `Anzeigename für User #${user.id} konnte nicht aufgelöst werden: ${(error as Error).message}`,
      );

      return `User #${user.id}`;
    }
  }
}
