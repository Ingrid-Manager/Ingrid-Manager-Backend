import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateAvmLocationDto {
  @IsNumber()
  id!: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @IsOptional()
  @IsString()
  ahaurl?: string;

  @IsOptional()
  @IsString()
  ahauser?: string;

  /** Only applied when non-empty; an empty value keeps the stored password. */
  @IsOptional()
  @IsString()
  ahapassword?: string;
}
