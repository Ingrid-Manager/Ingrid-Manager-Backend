import { IsDateString, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateResourceEventDto {
  @IsNumber()
  id!: number;

  @IsOptional()
  @IsString()
  title!: string;

  @IsOptional()
  @IsDateString()
  start!: string;

  @IsOptional()
  @IsDateString()
  end!: string;

  @IsOptional()
  @IsNumber()
  resourceid!: number;
}
