import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../roles/roles.decorator';
import { AuthGuard } from '@nestjs/passport';
import { RoleEnum } from '../roles/roles.enum';
import { RolesGuard } from '../roles/roles.guard';
import { ResourceService } from './resource.service';
import { CreateResourceDto } from './application/dto/create-resource.dto';
import { UpdateResourceDto } from './application/dto/update-resource.dto';

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({
  path: 'resource',
  version: '1',
})
export class ResourceController {
  constructor(private readonly service: ResourceService) {}

  @Roles(RoleEnum.admin, RoleEnum.verwaltung)
  @Post('create')
  createResource(@Body() dto: CreateResourceDto) {
    return this.service.create(dto);
  }

  @Roles(RoleEnum.admin, RoleEnum.verwaltung)
  @Post('find')
  findOneWithBody(@Body() body: { id: number }) {
    return this.service.findOne(body.id);
  }

  @Roles(RoleEnum.admin, RoleEnum.verwaltung)
  @Get('list')
  findAll() {
    return this.service.findAll();
  }

  @Roles(RoleEnum.admin, RoleEnum.verwaltung, RoleEnum.user, RoleEnum.guest)
  @Get('names')
  findNames() {
    return this.service.findNames();
  }

  @Roles(RoleEnum.admin, RoleEnum.verwaltung)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe)
    id: number,

    @Body()
    dto: UpdateResourceDto,
  ) {
    return this.service.update(id, dto);
  }
}
