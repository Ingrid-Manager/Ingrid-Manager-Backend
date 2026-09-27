import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';

import { AuditLogService } from '../audit-log.service';
import { AuditAction } from '../audit-action.enum';
import { AuditEntityType } from '../audit-entity-type.enum';
import { AuditService } from '../audit-service.enum';

/**
 * Ergänzt die bestehende Fehlerbehandlung um ein kurzes Audit-Log für echte
 * Server-/Systemfehler (Status >= 500 oder unbehandelte Exceptions).
 * Normale Validierungs-/Berechtigungsfehler (400/401/403/404) werden bewusst
 * NICHT geloggt, um das Audit-Log nicht mit Rauschen zu fluten. Ändert die
 * eigentliche Fehlerantwort an den Client nicht - delegiert dafür an die
 * Standard-Fehlerbehandlung von Nest.
 */
@Injectable()
@Catch()
export class AuditErrorFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(AuditErrorFilter.name);

  constructor(private readonly auditLogService: AuditLogService) {
    super();
  }

  async catch(exception: unknown, host: ArgumentsHost): Promise<void> {
    try {
      await this.logIfCriticalError(exception, host);
    } catch (loggingError) {
      // Audit-Logging darf die eigentliche Fehlerantwort nie beeinflussen.
      this.logger.error(
        `Audit-Log-Eintrag für Systemfehler konnte nicht gespeichert werden: ${(loggingError as Error).message}`,
      );
    }

    super.catch(exception, host);
  }

  private async logIfCriticalError(
    exception: unknown,
    host: ArgumentsHost,
  ): Promise<void> {
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    if (status < HttpStatus.INTERNAL_SERVER_ERROR) {
      return;
    }

    const request = host.switchToHttp().getRequest();
    const requestUser = request?.user;
    const message =
      exception instanceof Error ? exception.message : 'Unbekannter Fehler';

    await this.auditLogService.log({
      user: requestUser?.id ? { id: requestUser.id } : null,
      action: AuditAction.SYSTEM_ERROR,
      service: AuditService.SYSTEM,
      entityType: AuditEntityType.SYSTEM,
      entityId: null,
      summary: `${message} (${request?.method ?? '?'} ${request?.url ?? '?'})`,
    });
  }
}
