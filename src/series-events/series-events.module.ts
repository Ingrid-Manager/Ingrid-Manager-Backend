import { Module } from '@nestjs/common';

import { TypeOrmModule } from '@nestjs/typeorm';

import { SeriesEvent } from './infrastructure/relational/persistence/entities/series-event.entity';

import { CalendarEvent } from '../calendar-events/infrastructure/relational/persistence/entities/calendar-event.entity';

import { SeriesEventsService } from './series-events.service';

import { SeriesGeneratorService } from './services/series-generator.service';
import { HolidayService } from './services/holiday.service';
import { OverlapService } from './services/overlap.service';
import { SeriesEventsController } from './series-events.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SeriesEvent, CalendarEvent])],

  providers: [
    SeriesEventsService,
    SeriesGeneratorService,
    HolidayService,
    OverlapService,
  ],

  controllers: [SeriesEventsController],

  exports: [SeriesEventsService, SeriesGeneratorService],
})
export class SeriesEventsModule {}
