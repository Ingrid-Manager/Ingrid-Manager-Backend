import { Controller, Post, UseGuards } from '@nestjs/common';
import { ReorganizationService } from './reorganization.service';
import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../roles/roles.guard';

@Roles(RoleEnum.admin)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({
  path: 'reorganization',
  version: '1',
})
export class ReorganizationController {
  constructor(private readonly service: ReorganizationService) {}

  @Post('run')
  run() {
    return this.service.runNow();
  }
}
