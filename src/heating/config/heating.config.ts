import { registerAs } from '@nestjs/config';
import {
  IsIn,
  IsInt,
  ValidateIf,
  IsString,
  Matches,
  Min,
} from 'class-validator';
import validateConfig from '../../utils/validate-config';
import { HeatingConfig } from './heating-config.type';

const MONTH_DAY_PATTERN = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

// Leere Werte (z. B. `HEATING_HALLWAY_ROOM_ID=`) gelten als nicht gesetzt.
const isSet = (key: keyof EnvironmentVariablesValidator) =>
  ValidateIf((env: EnvironmentVariablesValidator) => !!env[key]);

class EnvironmentVariablesValidator {
  @IsString()
  @IsIn(['true', 'false'])
  @isSet('HEATING_ENABLED')
  HEATING_ENABLED!: string;

  @IsString()
  @Matches(MONTH_DAY_PATTERN, {
    message: 'HEATING_SEASON_START muss im Format MM-DD angegeben werden',
  })
  @isSet('HEATING_SEASON_START')
  HEATING_SEASON_START!: string;

  @IsString()
  @Matches(MONTH_DAY_PATTERN, {
    message: 'HEATING_SEASON_END muss im Format MM-DD angegeben werden',
  })
  @isSet('HEATING_SEASON_END')
  HEATING_SEASON_END!: string;

  @IsInt()
  @Min(1)
  @isSet('HEATING_HALLWAY_ROOM_ID')
  HEATING_HALLWAY_ROOM_ID!: number;
}

export default registerAs<HeatingConfig>('heating', () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  return {
    enabled: process.env.HEATING_ENABLED === 'true',
    seasonStart: process.env.HEATING_SEASON_START || null,
    seasonEnd: process.env.HEATING_SEASON_END || null,
    hallwayRoomId: process.env.HEATING_HALLWAY_ROOM_ID
      ? parseInt(process.env.HEATING_HALLWAY_ROOM_ID, 10)
      : null,
  };
});
