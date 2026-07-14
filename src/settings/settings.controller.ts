import { Controller, Get, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { SettingsDto } from './dto/settings.dto';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../roles/roles.guard';
import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({
  path: 'settings',
  version: '1',
})
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Roles(RoleEnum.admin, RoleEnum.verwaltung)
  @Get()
  getSettings(): SettingsDto {
    return this.settingsService.getSettings();
  }

  @Roles(RoleEnum.admin, RoleEnum.verwaltung, RoleEnum.user, RoleEnum.guest)
  @Get('version')
  getVersion(): { version: string } {
    return this.settingsService.getVersion();
  }
}
