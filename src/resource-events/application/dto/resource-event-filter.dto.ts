import { IsDateString, IsNumber, IsOptional } from 'class-validator';

export class ResourceEventFilterDto {
  @IsDateString()
  start!: string;

  @IsDateString()
  end!: string;

  @IsOptional()
  @IsNumber()
  resourceid?: number;
}
