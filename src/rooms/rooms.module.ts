import { Module } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { RoomsController } from './rooms.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Room } from './infrastructure/relational/persistence/entities/room.entity';
import { AvmLocation } from '../avm-locations/infrastructure/relational/persistence/entities/avm-location.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Room, AvmLocation])],
  providers: [RoomsService],
  controllers: [RoomsController],
})
export class RoomsModule {}
