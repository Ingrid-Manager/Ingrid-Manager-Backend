import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { HolidaySeedService } from './holiday-seed.service';
import { AvmLocation } from '../../../../avm-locations/infrastructure/relational/persistence/entities/avm-location.entity';
import { Category } from '../../../../categories/infrastructure/relational/persistence/entities/category.entity';
import { Room } from '../../../../rooms/infrastructure/relational/persistence/entities/room.entity';
import { UserEntity } from '../../../../users/infrastructure/persistence/relational/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Category, Room, AvmLocation, UserEntity]),
  ],
  providers: [HolidaySeedService],
  exports: [HolidaySeedService],
})
export class HolidaySeedModule {}
