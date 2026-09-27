import { Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import { RolesGuard } from '../roles/roles.guard';
import { HeatingRulesService } from './heating-rules.service';
import { HeatingPreviewQueryDto } from './application/dto/heating-preview-query.dto';

@Roles(RoleEnum.admin, RoleEnum.verwaltung)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({
  path: 'heating',
  version: '1',
})
export class HeatingRulesController {
  constructor(private readonly service: HeatingRulesService) {}

  /** Saison-Konfiguration (.env) und aktueller heated-Zustand je Raum. */
  @Get('status')
  status() {
    return this.service.getStatus();
  }

  /**
   * Vorschau (dryRun): welche Schaltbefehle würden jetzt bzw. zum
   * Zeitpunkt `at` ausgelöst? Ändert weder Zustand noch Thermostate.
   */
  @Get('preview')
  preview(@Query() query: HeatingPreviewQueryDto) {
    const now = query.at ? new Date(query.at) : new Date();
    return this.service.run(now, { dryRun: true });
  }

  /** Auswertung sofort ausführen und Befehle senden. */
  @Roles(RoleEnum.admin)
  @Post('run')
  run(@Req() req) {
    return this.service.run(new Date(), { user: req.user });
  }

  /** Initialzustand: alle Räume absenken und heated = false setzen. */
  @Roles(RoleEnum.admin)
  @Post('init')
  init(@Req() req) {
    return this.service.initialize(req.user);
  }
}
