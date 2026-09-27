import { Module } from '@nestjs/common';
import { AvmLocationsService } from './avm-locations.service';
import { AvmLocationsController } from './avm-locations.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AvmLocation } from './infrastructure/relational/persistence/entities/avm-location.entity';
import { Room } from '../rooms/infrastructure/relational/persistence/entities/room.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AvmLocation, Room])],
  providers: [AvmLocationsService],
  controllers: [AvmLocationsController],
  exports: [TypeOrmModule, AvmLocationsService],
})
export class AvmLocationsModule {}
