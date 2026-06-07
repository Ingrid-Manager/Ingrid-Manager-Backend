import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ReorganizationController } from './reorganization.controller';
import { ReorganizationService } from './reorganization.service';

import { CalendarEvent } from '../calendar-events/infrastructure/relational/persistence/entities/calendar-event.entity';
import { Category } from '../categories/infrastructure/relational/persistence/entities/category.entity';
import { Room } from '../rooms/infrastructure/relational/persistence/entities/room.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CalendarEvent, Category, Room])],
  controllers: [ReorganizationController],
  providers: [ReorganizationService],
  exports: [ReorganizationService],
})
export class ReorganizationModule {}
