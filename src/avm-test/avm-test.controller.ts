import { Controller, Get, UseGuards } from '@nestjs/common';
import { AvmTestService } from './avm-test.service';
import { Roles } from '../roles/roles.decorator';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../roles/roles.guard';
import { RoleEnum } from '../roles/roles.enum';

@Controller('avm-test')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(RoleEnum.admin)
export class AvmTestController {
  constructor(private readonly service: AvmTestService) {}

  @Get('ping')
  ping() {
    return this.service.ping();
  }

  @Get('devices')
  devices() {
    return this.service.devices();
  }

  @Get('thermostats')
  thermostats() {
    return this.service.thermostats();
  }
}
