import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Room } from '../rooms/infrastructure/relational/persistence/entities/room.entity';
import { CalendarEvent } from '../calendar-events/infrastructure/relational/persistence/entities/calendar-event.entity';
import { HeatingRulesController } from './heating-rules.controller';
import { HeatingRulesService } from './heating-rules.service';
import {
  HEATING_COMMAND_DISPATCHER,
  LoggingHeatingCommandDispatcher,
} from './dispatcher/heating-command-dispatcher';

@Module({
  imports: [TypeOrmModule.forFeature([Room, CalendarEvent])],
  controllers: [HeatingRulesController],
  providers: [
    HeatingRulesService,
    // Bis das Fritzbox-Modul fertig ist, werden die Schaltbefehle nur
    // protokolliert. Anschließend hier die Fritzbox-Implementierung von
    // HeatingCommandDispatcher eintragen.
    {
      provide: HEATING_COMMAND_DISPATCHER,
      useClass: LoggingHeatingCommandDispatcher,
    },
  ],
  exports: [HeatingRulesService],
})
export class HeatingRulesModule {}
