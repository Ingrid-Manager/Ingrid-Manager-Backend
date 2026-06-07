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
import { CalendarEventsService } from './calendar-events.service';
import { CalendarEventFilterDto } from './application/dto/calendar-event-filter.dto';
import { UpdateCalendarEventDto } from './application/dto/update-calendar-event.dto';
import { Roles } from '../roles/roles.decorator';
import { AuthGuard } from '@nestjs/passport';
import { RoleEnum } from '../roles/roles.enum';
import { RolesGuard } from '../roles/roles.guard';
import { CreateCalendarEventDto } from './application/dto/create-calendar-event.dto';

@Roles(RoleEnum.admin, RoleEnum.verwaltung, RoleEnum.user)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({
  path: 'calendar-events',
  version: '1',
})
export class CalendarEventsController {
  constructor(private readonly service: CalendarEventsService) {}

  @Post()
  create(@Body() dto: CreateCalendarEventDto, @Req() req) {
    return this.service.create(dto, req.user);
  }

  @Post('range')
  findWithBody(@Body() query: CalendarEventFilterDto) {
    return this.service.findInRange(query);
  }

  @Patch()
  update(
    @Body(new ValidationPipe())
    dto: UpdateCalendarEventDto,
    @Req() req,
  ) {
    return this.service.update(dto, req.user);
  }

  @Delete(':id')
  delete(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.service.delete(id, req.user);
  }

  /*@Delete()
  delete(
    @Body(new ValidationPipe())
    dto: DeleteCalendarEventDto,
    @Req() req,
  ) {
    return this.service.delete(dto.id, req.user);
  } */
}
