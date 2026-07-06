import { CalendarEvent } from '../../infrastructure/relational/persistence/entities/calendar-event.entity';

export class HeatingCalendarEventsDto {
  runningEvent?: CalendarEvent | null = null;
  nextEvent?: CalendarEvent | null = null;
  previousEvent?: CalendarEvent | null = null;
}
