import { IsNumber, IsOptional, IsString, ValidateIf } from 'class-validator';

import { IsFritzBoxUrl } from '../../../validation/is-fritzbox-url.validator';

export class UpdateAvmLocationDto {
  @IsNumber()
  id!: number;

  @IsOptional()
  @IsString()
  title?: string;

  // Leer bzw. nicht gesetzt ist erlaubt (Location ohne FRITZ!Box).
  @ValidateIf(
    (dto) =>
      dto.ahaurl !== undefined && dto.ahaurl !== null && dto.ahaurl !== '',
  )
  @IsString()
  @IsFritzBoxUrl()
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
