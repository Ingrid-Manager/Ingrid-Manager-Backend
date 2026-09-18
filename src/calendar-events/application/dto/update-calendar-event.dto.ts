import {
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdateCalendarEventDto {
  @IsNumber()
  id!: number;

  @IsOptional()
  @IsString()
  title?: string;

  /*
   * Bewusst weiterhin als String typisiert/validiert (nicht @Type(() =>
   * Date) + @IsDate()): Nest führt class-transformer VOR class-validator
   * aus, ein zu Date transformiertes Feld würde also von @IsDate() zwar
   * akzeptiert, aber ein kaputter Eingabestring würde dabei zu einem
   * stillen "Invalid Date" statt einem klaren 422-Validierungsfehler.
   * Die eigentliche Date-Umwandlung passiert daher explizit im Service
   * (siehe CalendarEventsService.update), erst NACH der Validierung.
   */
  @IsOptional()
  @IsDateString()
  start?: string;

  @IsOptional()
  @IsDateString()
  end?: string;

  @IsOptional()
  @IsBoolean()
  allDay?: boolean;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isBackground?: boolean;

  @IsOptional()
  @IsNumber()
  roomid?: number;

  @IsOptional()
  @IsNumber()
  categoryid?: number;
}
