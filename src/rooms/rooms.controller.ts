import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Roles } from '../roles/roles.decorator';
import { AuthGuard } from '@nestjs/passport';
import { RoleEnum } from '../roles/roles.enum';
import { RolesGuard } from '../roles/roles.guard';
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './application/dto/create-room.dto';

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({
  path: 'rooms',
  version: '1',
})
export class RoomsController {
  constructor(private readonly service: RoomsService) {}

  @Roles(RoleEnum.admin, RoleEnum.verwaltung)
  @Post('create')
  createRoom(@Body() dto: CreateRoomDto) {
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
}
