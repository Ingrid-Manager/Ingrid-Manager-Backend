export class CalendarEventResponseDto {
  id!: number;
  title!: string;
  description!: string;
  start!: Date;
  end!: Date;
  allDay!: boolean;
  color?: string;
  room_title?: string;
  room_id?: number;
  user_id?: number;
  user_name?: string;
  isBackground?: boolean;
  rrule?: string;
}
