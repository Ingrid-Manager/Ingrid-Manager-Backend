import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import { RolesGuard } from '../roles/roles.guard';
import { AuditLogService } from './audit-log.service';
import { AuditLogFilterDto } from './application/dto/audit-log-filter.dto';

@Roles(RoleEnum.admin, RoleEnum.verwaltung)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({ path: 'audit-log', version: '1' })
export class AuditLogController {
  constructor(private readonly service: AuditLogService) {}

  @Get()
  findAll(@Query() filter: AuditLogFilterDto) {
    return this.service.findAll(filter);
  }

  @Get(':entityType/:entityId')
  findForEntity(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ) {
    return this.service.findForEntity(entityType, entityId);
  }
}
