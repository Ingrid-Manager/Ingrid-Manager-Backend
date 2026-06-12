import {
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateCalendarEventDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsDateString()
  start!: string;

  @IsDateString()
  end!: string;

  @IsOptional()
  @IsBoolean()
  allDay?: boolean;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isBackground?: boolean;

  @IsNumber()
  roomid!: number;

  @IsNumber()
  categoryid!: number;
}
