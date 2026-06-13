import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
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

  @IsArray()
  @ArrayNotEmpty()
  weekdays!: number[];

  @IsBoolean()
  runDuringSchoolHolidays!: boolean;
}
