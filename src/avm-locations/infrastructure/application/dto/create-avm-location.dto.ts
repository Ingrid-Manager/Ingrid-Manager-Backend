import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateAvmLocationDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @IsString()
  ahaurl?: string;

  @IsOptional()
  @IsString()
  ahauser?: string;

  @IsOptional()
  @IsString()
  ahapassword?: string;
}
