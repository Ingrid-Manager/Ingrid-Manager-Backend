import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SeriesEvent } from '../series-events/infrastructure/relational/persistence/entities/series-event.entity';
import { CalendarEvent } from '../calendar-events/infrastructure/relational/persistence/entities/calendar-event.entity';
import { UsersModule } from '../users/users.module';

import { OwnershipTransferService } from './ownership-transfer.service';
import { OwnershipTransferController } from './ownership-transfer.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([SeriesEvent, CalendarEvent]),
    UsersModule,
  ],
  providers: [OwnershipTransferService],
  controllers: [OwnershipTransferController],
})
export class OwnershipTransferModule {}
