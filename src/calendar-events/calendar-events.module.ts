import { Module } from '@nestjs/common';
import { CalendarEventsService } from './calendar-events.service';
import { CalendarEventsController } from './calendar-events.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CalendarEvent } from './infrastructure/relational/persistence/entities/calendar-event.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CalendarEvent])],
  providers: [CalendarEventsService],
  controllers: [CalendarEventsController],
  // Exportiert, damit das eigenständige PrintModul (src/print) Termine
  // für den Ausdruck laden kann, ohne die Logik zu duplizieren.
  exports: [CalendarEventsService],
})
export class CalendarEventsModule {}
