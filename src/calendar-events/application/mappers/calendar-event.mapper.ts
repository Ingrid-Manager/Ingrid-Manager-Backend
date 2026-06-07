import { CalendarEvent } from '../../infrastructure/relational/persistence/entities/calendar-event.entity';
import { CalendarEventResponseDto } from '../dto/calendar-event-response.dto';

export class CalnedarEventMapper {
  static toResponse(entity: CalendarEvent): CalendarEventResponseDto {
    return {
      id: entity.id,
      title: entity.title,
      description: entity.description,
      start: entity.start!,
      end: entity.end!,
      isBackground: entity.isBackground,
      allDay: entity.allDay ?? false,
      color: entity.room?.color ?? '#ff0000',
      room_id: entity.room?.id,
      room_title: entity.room?.title,
      user_id: entity.user.id,
      user_name: entity.user.firstName + ' ' + entity.user.lastName,
      rrule: entity.rrule,
    };
  }
}
