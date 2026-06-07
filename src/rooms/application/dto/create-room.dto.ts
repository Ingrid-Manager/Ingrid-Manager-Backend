import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

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

  @IsString()
  @IsOptional()
  color?: string;

  @IsBoolean()
  @IsOptional()
  hidden?: boolean | false;

  @IsNumber()
  @IsOptional()
  locationid?: number;
}
