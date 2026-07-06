import {
  Body,
  Controller,
  Delete,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';

import { AuthGuard } from '@nestjs/passport';

import { Roles } from '../roles/roles.decorator';
import { RolesGuard } from '../roles/roles.guard';
import { RoleEnum } from '../roles/roles.enum';

import { ResourceEventsService } from './resource-events.service';

import { CreateResourceEventDto } from './application/dto/create-resource-event.dto';
import { UpdateResourceEventDto } from './application/dto/update-resource-event.dto';
import { ResourceEventFilterDto } from './application/dto/resource-event-filter.dto';

@Roles(RoleEnum.admin, RoleEnum.verwaltung, RoleEnum.user, RoleEnum.guest)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({
  path: 'resource-events',
  version: '1',
})
export class ResourceEventsController {
  constructor(private readonly service: ResourceEventsService) {}

  @Roles(RoleEnum.admin, RoleEnum.verwaltung, RoleEnum.user)
  @Post()
  create(@Body() dto: CreateResourceEventDto, @Req() req) {
    return this.service.create(dto, req.user);
  }

  @Post('range')
  findWithBody(@Body() query: ResourceEventFilterDto) {
    return this.service.findInRange(query);
  }

  @Roles(RoleEnum.admin, RoleEnum.verwaltung, RoleEnum.user)
  @Patch()
  update(
    @Body(new ValidationPipe())
    dto: UpdateResourceEventDto,
    @Req() req,
  ) {
    return this.service.update(dto, req.user);
  }

  @Roles(RoleEnum.admin, RoleEnum.verwaltung, RoleEnum.user)
  @Delete(':id')
  delete(
    @Param('id', ParseIntPipe)
    id: number,
    @Req() req,
  ) {
    return this.service.delete(id, req.user);
  }
}
