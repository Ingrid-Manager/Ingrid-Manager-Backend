import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Room } from '../rooms/infrastructure/relational/persistence/entities/room.entity';
import { CalendarEvent } from '../calendar-events/infrastructure/relational/persistence/entities/calendar-event.entity';
import { AvmLocation } from '../avm-locations/infrastructure/relational/persistence/entities/avm-location.entity';
import { HeatingRulesController } from './heating-rules.controller';
import { HeatingRulesService } from './heating-rules.service';
import { HEATING_COMMAND_DISPATCHER } from './dispatcher/heating-command-dispatcher';
import { FritzBoxHeatingCommandDispatcher } from './dispatcher/fritzbox-heating-command-dispatcher';
import { FritzBoxConnectionService } from './fritzbox/fritzbox-connection.service';

@Module({
  imports: [TypeOrmModule.forFeature([Room, CalendarEvent, AvmLocation])],
  controllers: [HeatingRulesController],
  providers: [
    HeatingRulesService,
    FritzBoxConnectionService,
    // Schaltbefehle der Heizregeln an die FRITZ!Box der jeweiligen
    // AVM Location übertragen.
    {
      provide: HEATING_COMMAND_DISPATCHER,
      useClass: FritzBoxHeatingCommandDispatcher,
    },
  ],
  exports: [HeatingRulesService],
})
export class HeatingRulesModule {}
