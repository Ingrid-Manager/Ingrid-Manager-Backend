import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
} from 'class-validator';

/** Maximale Anzahl Räume, die in einem Ausdruck berücksichtigt werden
 *  können. Gilt sowohl für eine explizite Auswahl als auch für den
 *  Fall "alle Räume" (siehe PrintService.resolveRooms). */
export const MAX_PRINTABLE_ROOMS = 10;

export enum PrintViewType {
  week = 'week',
  month = 'month',
  year = 'year',
}

export class PrintCalendarDto {
  /**
   * Welche Druckvorlage verwendet werden soll.
   */
  @IsEnum(PrintViewType)
  type!: PrintViewType;

  /**
   * Ein beliebiges Datum innerhalb des zu druckenden Zeitraums,
   * z. B. der aktuell im Kalender angezeigte Tag.
   * ISO-8601, z. B. "2026-06-15".
   */
  @IsDateString()
  date!: string;

  /**
   * IDs der Räume, die im Ausdruck berücksichtigt werden sollen.
   * Wird kein Wert übergeben, werden alle (nicht ausgeblendeten) Räume
   * gedruckt — sofern es insgesamt nicht mehr als MAX_PRINTABLE_ROOMS gibt
   * (siehe PrintService).
   * Max. MAX_PRINTABLE_ROOMS Einträge, da die Druckvorlagen (v. a. die
   * Jahresansicht) für mehr Räume nicht ausgelegt sind (Legende/Farben).
   */
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(MAX_PRINTABLE_ROOMS, {
    message: `Es können maximal ${MAX_PRINTABLE_ROOMS} Räume gleichzeitig gedruckt werden.`,
  })
  @Type(() => Number)
  @IsInt({ each: true })
  roomIds?: number[];
}
