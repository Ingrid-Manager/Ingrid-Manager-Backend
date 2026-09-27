import { registerAs } from '@nestjs/config';

import { IsIn, IsOptional, IsString, Matches } from 'class-validator';
import validateConfig from '../../utils/validate-config';
import { HeatingConfig } from './heating-config.type';

const MONTH_DAY_PATTERN = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

class EnvironmentVariablesValidator {
  @IsString()
  @Matches(MONTH_DAY_PATTERN)
  @IsOptional()
  HEATING_SEASON_START!: string;

  @IsString()
  @Matches(MONTH_DAY_PATTERN)
  @IsOptional()
  HEATING_SEASON_END!: string;

  @IsString()
  @Matches(/^\s*\d+(\s*,\s*\d+)*\s*$/)
  @IsOptional()
  HEATING_HALLWAY_ROOM_ID!: string;

  @IsString()
  @IsIn(['true', 'false'])
  @IsOptional()
  HEATING_SCHEDULER_ENABLED!: string;
}

const HEATING_ENV_KEYS = [
  'HEATING_SEASON_START',
  'HEATING_SEASON_END',
  'HEATING_HALLWAY_ROOM_ID',
  'HEATING_SCHEDULER_ENABLED',
] as const;

/*
 * Leere Werte (z. B. `HEATING_HALLWAY_ROOM_ID=` aus env-example) gelten als
 * nicht gesetzt. @IsOptional() überspringt nur null/undefined, ein leerer
 * String würde sonst die Validierung scheitern lassen und den Start des
 * Backends verhindern.
 */
export function readHeatingEnv(
  env: Record<string, string | undefined>,
): Record<string, string | undefined> {
  const result: Record<string, string | undefined> = {};

  for (const key of HEATING_ENV_KEYS) {
    const value = env[key]?.trim();
    result[key] = value ? value : undefined;
  }

  return result;
}

export function parseHallwayRoomIds(value: string | undefined): number[] {
  if (!value || !value.trim()) {
    return [];
  }

  return value
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((id) => Number.isInteger(id) && id > 0);
}

export default registerAs<HeatingConfig>('heating', () => {
  const env = readHeatingEnv(process.env);

  validateConfig(env, EnvironmentVariablesValidator);

  return {
    seasonStart: env.HEATING_SEASON_START,
    seasonEnd: env.HEATING_SEASON_END,
    hallwayRoomIds: parseHallwayRoomIds(env.HEATING_HALLWAY_ROOM_ID),
    schedulerEnabled: env.HEATING_SCHEDULER_ENABLED !== 'false',
  };
});
