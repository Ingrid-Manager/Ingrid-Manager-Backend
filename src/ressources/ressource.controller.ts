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
import { RessourceService } from './ressource.service';
import { CreateRessourceDto } from './application/dto/create-ressource.dto';
import { UpdateRessourceDto } from './application/dto/update-ressource.dto';

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({
  path: 'ressource',
  version: '1',
})
export class RessourceController {
  constructor(private readonly service: RessourceService) {}

  @Roles(RoleEnum.admin, RoleEnum.verwaltung)
  @Post('create')
  createRessource(@Body() dto: CreateRessourceDto) {
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
    dto: UpdateRessourceDto,
  ) {
    return this.service.update(id, dto);
  }
}
