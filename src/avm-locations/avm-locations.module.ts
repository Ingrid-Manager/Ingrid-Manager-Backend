import { Module } from '@nestjs/common';
import { AvmLocationsService } from './avm-locations.service';
import { AvmLocationsController } from './avm-locations.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AvmLocation } from './infrastructure/relational/persistence/entities/avm-location.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AvmLocation])],
  providers: [AvmLocationsService],
  controllers: [AvmLocationsController],
  exports: [TypeOrmModule],
})
export class AvmLocationsModule {}
