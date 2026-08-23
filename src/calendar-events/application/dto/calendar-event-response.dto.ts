import { SeriesFrequency } from '../../../series-events/frequencys.enum';

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
  categoryid?: number;
  user_id?: number;
  user_name?: string;
  isBackground?: boolean;
  seriesid?: number;
  isModified!: boolean;
  /**
   * Wiederholungs-Rhythmus der Serie (falls Serientermin), z. B. für die
   * Druckfunktion: In der Jahresansicht werden wöchentlich/zweiwöchentlich
   * wiederkehrende Termine ausgeblendet (siehe
   * print-fullcalendar-data.ts::buildYearEvents). `undefined` bei
   * Einzelterminen ohne Serie.
   */
  seriesFrequency?: SeriesFrequency;
}
