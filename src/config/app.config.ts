import { registerAs } from '@nestjs/config';
import { AppConfig } from './app-config.type';
import validateConfig from '.././utils/validate-config';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
} from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariablesValidator {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV!: Environment;

  @IsInt()
  @Min(0)
  @Max(65535)
  @IsOptional()
  APP_PORT!: number;

  // Pflicht: Links in Mails (Bestätigung, Passwort-Reset) und die
  // CORS-Freigabe hängen davon ab.
  @IsUrl({ require_tld: false })
  FRONTEND_DOMAIN!: string;

  @IsUrl({ require_tld: false })
  @IsOptional()
  BACKEND_DOMAIN!: string;

  @IsString()
  @IsOptional()
  API_PREFIX!: string;

  @IsString()
  @IsOptional()
  APP_FALLBACK_LANGUAGE!: string;

  @IsString()
  @IsOptional()
  APP_HEADER_LANGUAGE!: string;

  @IsUrl({ require_tld: false })
  @IsOptional()
  PDF_SERVICE_BASE_URL!: string;

  @IsString()
  @IsOptional()
  PDF_SERVICE_APP_KEY!: string;

  @IsString()
  @IsOptional()
  PDF_SERVICE_CALLBACK_KEY!: string;

  @IsString()
  @IsOptional()
  APP_CORS_ORIGINS!: string;

  @IsIn(['true', 'false'])
  @IsOptional()
  APP_SWAGGER_ENABLED!: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  HOLIDAY_CATEGORY_ID!: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  HOLIDAY_ROOM_ID!: number;
}

/**
 * Swagger (/docs) ist nur eingeschaltet, wenn APP_SWAGGER_ENABLED=true
 * gesetzt ist oder - ohne diese Angabe - NODE_ENV ausdrücklich
 * "development" ist. Ein fehlendes NODE_ENV (z. B. auf dem Server)
 * veröffentlicht die API-Dokumentation damit nicht mehr.
 */
export function isSwaggerEnabled(
  env: Record<string, string | undefined>,
): boolean {
  if (env.APP_SWAGGER_ENABLED) {
    return env.APP_SWAGGER_ENABLED === 'true';
  }

  return env.NODE_ENV === Environment.Development;
}

/**
 * Ermittelt die für CORS zugelassenen Origins.
 *
 * APP_CORS_ORIGINS (kommagetrennt) hat Vorrang; ohne diese Angabe ist nur
 * die Origin von FRONTEND_DOMAIN zugelassen. Pfade oder ein abschließender
 * Schrägstrich werden entfernt, da der Browser nur die Origin
 * (Schema, Host, Port) mitschickt.
 */
export function parseCorsOrigins(
  corsOrigins: string | undefined,
  frontendDomain: string | undefined,
): string[] {
  const configured = (corsOrigins ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const candidates = configured.length
    ? configured
    : frontendDomain
      ? [frontendDomain]
      : [];

  return [
    ...new Set(
      candidates.flatMap((value) => {
        // Ohne Schema (z. B. "ingrid-manager.de") sind beide Varianten erlaubt.
        const urls = /^[a-z][a-z\d+.-]*:\/\//i.test(value)
          ? [value]
          : [`https://${value}`, `http://${value}`];

        return urls.map((url) => {
          try {
            return new URL(url).origin;
          } catch {
            throw new Error(
              `Ungültige Origin "${value}" in APP_CORS_ORIGINS/FRONTEND_DOMAIN`,
            );
          }
        });
      }),
    ),
  ];
}

export default registerAs<AppConfig>('app', () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    name: process.env.APP_NAME || 'app',
    workingDirectory: process.env.PWD || process.cwd(),
    frontendDomain: process.env.FRONTEND_DOMAIN,
    backendDomain: process.env.BACKEND_DOMAIN ?? 'http://localhost',
    port: process.env.APP_PORT
      ? parseInt(process.env.APP_PORT, 10)
      : process.env.PORT
        ? parseInt(process.env.PORT, 10)
        : 3000,
    apiPrefix: process.env.API_PREFIX || 'api',
    fallbackLanguage: process.env.APP_FALLBACK_LANGUAGE || 'en',
    headerLanguage: process.env.APP_HEADER_LANGUAGE || 'x-custom-lang',
    logoURL:
      process.env.APP_LOGOURL || 'https://ingrid-manager.de/media/logo.png',
    iconURL:
      process.env.APP_ICONURL || 'https://ingrid-manager.de/media/icon.png',
    pdfServiceBaseUrl: process.env.PDF_SERVICE_BASE_URL,
    pdfServiceAppKey: process.env.PDF_SERVICE_APP_KEY,
    pdfServiceCallbackKey: process.env.PDF_SERVICE_CALLBACK_KEY || undefined,
    swaggerEnabled: isSwaggerEnabled(process.env),
    holidayCategoryId: process.env.HOLIDAY_CATEGORY_ID
      ? parseInt(process.env.HOLIDAY_CATEGORY_ID, 10)
      : undefined,
    holidayRoomId: process.env.HOLIDAY_ROOM_ID
      ? parseInt(process.env.HOLIDAY_ROOM_ID, 10)
      : undefined,
    corsOrigins: parseCorsOrigins(
      process.env.APP_CORS_ORIGINS,
      process.env.FRONTEND_DOMAIN,
    ),
  };
});
