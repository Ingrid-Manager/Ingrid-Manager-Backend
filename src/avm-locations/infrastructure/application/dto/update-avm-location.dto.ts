import { IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateAvmLocationDto {
  @IsNumber()
  id!: number;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  ahaurl?: string;

  @IsOptional()
  @IsString()
  ahauser?: string;

  @IsOptional()
  @IsString()
  ahapassword?: string;

  @IsOptional()
  @IsString()
  ahasid?: string;
}
