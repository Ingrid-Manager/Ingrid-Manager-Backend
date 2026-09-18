import { Injectable } from '@nestjs/common';

import {
  HolidayReorganizationService,
  ReorganizationActingUser,
} from './services/holiday-reorganization.service';
import { SeriesReorganizationService } from './services/series-reorganization.service';
import { Cron } from '@nestjs/schedule';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditAction } from '../audit-log/audit-action.enum';
import { AuditEntityType } from '../audit-log/audit-entity-type.enum';
import { AuditService } from '../audit-log/audit-service.enum';

@Injectable()
export class ReorganizationService {
  constructor(
    private readonly holidayReorganizationService: HolidayReorganizationService,
    private readonly seriesReorganizationService: SeriesReorganizationService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Cron('0 3 1 * *')
  async runMonthlyReorganization() {
    await this.holidayReorganizationService.run();
    await this.seriesReorganizationService.run();

    // Eigener, klar als automatisch markierter Log-Eintrag - unabhängig
    // vom eventtyp-spezifischen HOLIDAYS_IMPORTED-Eintrag, der pro
    // Ferien-Import geschrieben wird, damit im Aktivitätsprotokoll auf
    // den ersten Blick erkennbar ist, dass es sich um den planmäßigen
    // Cron-Lauf handelt (nicht um einen manuell ausgelösten).
    await this.auditLogService.log({
      user: null,
      action: AuditAction.REORGANIZATION_RUN,
      service: AuditService.REORGANIZATION,
      entityType: AuditEntityType.SYSTEM,
      entityId: null,
      summary:
        'System hat den automatischen Reorg-Lauf (Cron, monatlich) ausgeführt',
    });
  }

  async runNow(user?: ReorganizationActingUser | null) {
    await this.holidayReorganizationService.run(user);
    await this.seriesReorganizationService.run();

    const userLabel = await this.auditLogService.getUserLabel(user ?? null);
    await this.auditLogService.log({
      user: user ? { id: user.id } : null,
      userLabel,
      action: AuditAction.REORGANIZATION_RUN,
      service: AuditService.REORGANIZATION,
      entityType: AuditEntityType.SYSTEM,
      entityId: null,
      summary: `${userLabel} hat den Reorg-Lauf manuell gestartet`,
    });

    return { success: true };
  }

  async listHolidays() {
    return this.holidayReorganizationService.list();
  }
}
