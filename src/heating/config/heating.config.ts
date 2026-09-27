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
  validateConfig(process.env, EnvironmentVariablesValidator);

  return {
    seasonStart: process.env.HEATING_SEASON_START,
    seasonEnd: process.env.HEATING_SEASON_END,
    hallwayRoomIds: parseHallwayRoomIds(process.env.HEATING_HALLWAY_ROOM_ID),
    schedulerEnabled: process.env.HEATING_SCHEDULER_ENABLED !== 'false',
  };
});
