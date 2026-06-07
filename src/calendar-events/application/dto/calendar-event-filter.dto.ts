import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsNumber, IsOptional } from 'class-validator';

export class CalendarEventFilterDto {
  @IsDateString()
  start!: string;

  @IsDateString()
  end!: string;

  @IsOptional()
  @IsNumber()
  roomid?: number;

  @IsOptional()
  @IsNumber()
  categoryid?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isBackground?: boolean;
}
