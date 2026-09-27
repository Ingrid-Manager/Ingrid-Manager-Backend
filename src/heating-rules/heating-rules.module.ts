import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Room } from '../rooms/infrastructure/relational/persistence/entities/room.entity';
import { CalendarEvent } from '../calendar-events/infrastructure/relational/persistence/entities/calendar-event.entity';
import { AvmLocation } from '../avm-locations/infrastructure/relational/persistence/entities/avm-location.entity';
import { HeatingRulesController } from './heating-rules.controller';
import { HeatingRulesService } from './heating-rules.service';
import { HEATING_COMMAND_DISPATCHER } from './dispatcher/heating-command-dispatcher';
import {
  FRITZBOX_FACTORY,
  FritzboxConnectionService,
  defaultFritzBoxFactory,
} from './fritzbox/fritzbox-connection.service';
import { FritzboxHeatingCommandDispatcher } from './fritzbox/fritzbox-heating-command-dispatcher';

@Module({
  imports: [TypeOrmModule.forFeature([Room, CalendarEvent, AvmLocation])],
  controllers: [HeatingRulesController],
  providers: [
    HeatingRulesService,
    FritzboxConnectionService,
    { provide: FRITZBOX_FACTORY, useValue: defaultFritzBoxFactory },
    {
      provide: HEATING_COMMAND_DISPATCHER,
      useClass: FritzboxHeatingCommandDispatcher,
    },
  ],
  exports: [HeatingRulesService],
})
export class HeatingRulesModule {}
