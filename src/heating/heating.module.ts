import { Module } from '@nestjs/common';

import { HeatingController } from './heating.controller';
import { HeatingService } from './heating.service';

@Module({
  controllers: [HeatingController],
  providers: [HeatingService],
  exports: [HeatingService],
})
export class HeatingModule {}
