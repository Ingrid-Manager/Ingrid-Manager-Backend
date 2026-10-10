import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

import { IsFritzBoxUrl } from '../../avm-locations/validation/is-fritzbox-url.validator';

export class ConnectHeatingDto {
  @ApiProperty({
    example: 'fritzbox-home',
    description: 'Eindeutige ID der FRITZ!Box',
  })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({
    example: 'Meine FRITZ!Box',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    example: 'http://192.168.178.1',
    description:
      'AHA URL der FRITZ!Box (HTTPS; HTTP nur für lokale bzw. private Adressen)',
  })
  @IsFritzBoxUrl()
  ahaUrl: string;

  @ApiProperty({
    example: 'admin',
  })
  @IsString()
  @IsNotEmpty()
  ahaUser: string;

  @ApiProperty({
    example: 'secret',
    format: 'password',
  })
  @IsString()
  @IsNotEmpty()
  ahaPassword: string;
}
