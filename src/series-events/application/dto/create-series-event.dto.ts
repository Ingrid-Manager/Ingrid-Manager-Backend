import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { SeriesFrequency } from '../../frequencys.enum';

export class CreateSeriesEventDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  roomid!: number;

  @IsNumber()
  categoryid!: number;

  @IsEnum(SeriesFrequency)
  frequency!: SeriesFrequency;

  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  startTime!: string;

  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  endTime!: string;

  @IsDateString()
  seriesStart!: string;

  @IsDateString()
  seriesEnd!: string;

  /*
   * JS-Konvention (Date.getDay()): 0 = Sonntag ... 6 = Samstag.
   */
  @IsArray()
  @ArrayNotEmpty()
  @IsIn([0, 1, 2, 3, 4, 5, 6], { each: true })
  weekdays!: number[];

  @IsBoolean()
  runDuringSchoolHolidays!: boolean;
}
