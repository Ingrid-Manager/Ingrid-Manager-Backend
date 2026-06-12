import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ReorganizationController } from './reorganization.controller';
import { ReorganizationService } from './reorganization.service';

import { CalendarEvent } from '../calendar-events/infrastructure/relational/persistence/entities/calendar-event.entity';
import { Category } from '../categories/infrastructure/relational/persistence/entities/category.entity';
import { Room } from '../rooms/infrastructure/relational/persistence/entities/room.entity';
import { HolidayReorganizationService } from './services/holiday-reorganization.service';
import { SeriesReorganizationService } from './services/series-reorganization.service';
import { SeriesEvent } from '../series-events/infrastructure/relational/persistence/entities/series-event.entity';
import { SeriesEventsModule } from '../series-events/series-events.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CalendarEvent, Category, Room, SeriesEvent]),
    SeriesEventsModule,
  ],
  controllers: [ReorganizationController],
  providers: [
    ReorganizationService,
    HolidayReorganizationService,
    SeriesReorganizationService,
  ],
  exports: [ReorganizationService],
})
export class ReorganizationModule {}
