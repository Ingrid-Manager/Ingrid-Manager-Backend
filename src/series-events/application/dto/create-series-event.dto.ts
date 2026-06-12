import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

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
