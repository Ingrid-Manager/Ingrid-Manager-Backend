import { registerAs } from '@nestjs/config';

import { IsIn, IsOptional, IsString, Matches } from 'class-validator';
import validateConfig from '../../utils/validate-config';
import { HeatingConfig } from './heating-config.type';
import { parseHeatingSeason } from '../domain/heating-season';

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

  @IsString()
  @IsOptional()
  HEATING_LOG_FILE!: string;

  @IsString()
  @Matches(/^\d+$/)
  @IsOptional()
  HEATING_LOG_FILE_MAX_SIZE_MB!: string;
}

export const DEFAULT_HEATING_LOG_FILE = 'logs/heating.log';
export const DEFAULT_HEATING_LOG_FILE_MAX_SIZE_MB = 10;

const HEATING_ENV_KEYS = [
  'HEATING_SEASON_START',
  'HEATING_SEASON_END',
  'HEATING_HALLWAY_ROOM_ID',
  'HEATING_SCHEDULER_ENABLED',
  'HEATING_LOG_FILE',
  'HEATING_LOG_FILE_MAX_SIZE_MB',
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

/*
 * Nicht gesetzt: Default-Datei, "false"/"off": abgeschaltet (null).
 */
export function parseHeatingLogFile(value: string | undefined): string | null {
  if (!value) {
    return DEFAULT_HEATING_LOG_FILE;
  }

  return ['false', 'off'].includes(value.toLowerCase()) ? null : value;
}

/*
 * Die Regex-Prüfung oben lässt z. B. "02-30" durch. Eine ungültige oder nur
 * halb konfigurierte Heizsaison würde die Heizungssteuerung zur Laufzeit
 * still abschalten; deshalb bricht bereits der Start mit einer klaren
 * Meldung ab. Ganz ohne Saison (beide Werte leer) startet das Backend.
 */
export function assertValidHeatingSeason(
  start: string | undefined,
  end: string | undefined,
): void {
  if (!start && !end) {
    return;
  }

  if (!start || !end) {
    throw new Error(
      'HEATING_SEASON_START und HEATING_SEASON_END müssen gemeinsam gesetzt werden',
    );
  }

  if (!parseHeatingSeason(start, end)) {
    throw new Error(
      `Ungültige Heizsaison "${start}" bis "${end}" (erwartet gültige Kalendertage im Format MM-DD, z. B. 10-01)`,
    );
  }
}

export default registerAs<HeatingConfig>('heating', () => {
  const env = readHeatingEnv(process.env);

  validateConfig(env, EnvironmentVariablesValidator);
  assertValidHeatingSeason(env.HEATING_SEASON_START, env.HEATING_SEASON_END);

  return {
    seasonStart: env.HEATING_SEASON_START,
    seasonEnd: env.HEATING_SEASON_END,
    hallwayRoomIds: parseHallwayRoomIds(env.HEATING_HALLWAY_ROOM_ID),
    schedulerEnabled: env.HEATING_SCHEDULER_ENABLED !== 'false',
    logFile: parseHeatingLogFile(env.HEATING_LOG_FILE),
    logFileMaxSizeMb: env.HEATING_LOG_FILE_MAX_SIZE_MB
      ? Number(env.HEATING_LOG_FILE_MAX_SIZE_MB)
      : DEFAULT_HEATING_LOG_FILE_MAX_SIZE_MB,
  };
});
