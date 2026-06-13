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
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './application/dto/create-room.dto';
import { UpdateRoomDto } from './application/dto/update-room.dto';

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

  @Roles(RoleEnum.admin, RoleEnum.verwaltung)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe)
    id: number,

    @Body()
    dto: UpdateRoomDto,
  ) {
    return this.service.update(id, dto);
  }
}
