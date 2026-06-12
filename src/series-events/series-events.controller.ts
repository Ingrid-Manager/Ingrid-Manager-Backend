import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { AuthGuard } from '@nestjs/passport';

import { Roles } from '../roles/roles.decorator';
import { RolesGuard } from '../roles/roles.guard';
import { RoleEnum } from '../roles/roles.enum';

import { SeriesEventsService } from './series-events.service';

import { CreateSeriesEventDto } from './application/dto/create-series-event.dto';
import { UpdateSeriesEventDto } from './application/dto/update-series-event.dto';
import { UpdateSeriesFromDateDto } from './application/dto/update-series-from-date.dto';

@Roles(RoleEnum.admin, RoleEnum.verwaltung, RoleEnum.user)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({
  path: 'series-events',
  version: '1',
})
export class SeriesEventsController {
  constructor(private readonly service: SeriesEventsService) {}

  @Post()
  create(@Body() dto: CreateSeriesEventDto, @Req() req) {
    return this.service.create(dto, req.user);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe)
    id: number,
  ) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe)
    id: number,
    @Body()
    dto: UpdateSeriesEventDto,
  ) {
    dto.id = id;

    return this.service.update(dto);
  }

  @Patch(':id/split')
  updateFromDate(
    @Param('id', ParseIntPipe)
    id: number,
    @Body()
    dto: UpdateSeriesFromDateDto,
    @Req() req,
  ) {
    dto.id = id;

    return this.service.updateFromDate(dto, req.user);
  }

  @Delete(':id')
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.service.delete(id);
  }
}
