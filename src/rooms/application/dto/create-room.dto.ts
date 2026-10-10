import {
  IsBoolean,
  IsHexColor,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateRoomDto {
  @IsString()
  title!: string;

  @IsString()
  @IsOptional()
  avm_id?: string;

  @IsNumber()
  comfort_temp!: number;

  @IsNumber()
  empty_temp!: number;

  @IsNumber()
  prelim_time!: number;

  @IsBoolean()
  heated!: boolean;

  // Nur Hex-Farben (#rgb, #rrggbb, ...): der Wert landet u. a. in
  // style-Attributen der Druckvorlagen.
  @IsHexColor()
  @IsOptional()
  color?: string;

  @IsBoolean()
  @IsOptional()
  hidden?: boolean | false;

  @IsNumber()
  @IsOptional()
  locationid?: number;
}
