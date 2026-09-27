import { Module } from '@nestjs/common';

import { FritzBoxManager } from '../libs/fritzbox-aha/index.js';

import { AvmLocationsModule } from '../avm-locations/avm-locations.module';
import { CalendarEventsModule } from '../calendar-events/calendar-events.module';
import { RoomsModule } from '../rooms/rooms.module';
import { HeatingController } from './heating.controller';
import { HeatingService } from './heating.service';
import {
  FRITZBOX_MANAGER,
  FritzBoxConnectionManager,
} from './fritzbox-connection-manager.service';
import {
  HEATING_CLOCK,
  HeatingScheduler,
  systemClock,
} from './heating-scheduler.service';

@Module({
  imports: [AvmLocationsModule, CalendarEventsModule, RoomsModule],
  controllers: [HeatingController],
  providers: [
    HeatingService,
    FritzBoxConnectionManager,
    HeatingScheduler,
    {
      provide: FRITZBOX_MANAGER,
      useFactory: () => new FritzBoxManager(),
    },
    {
      provide: HEATING_CLOCK,
      useValue: systemClock,
    },
  ],
  exports: [HeatingService, FritzBoxConnectionManager, HeatingScheduler],
})
export class HeatingModule {}
