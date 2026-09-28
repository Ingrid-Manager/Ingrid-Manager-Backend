import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { appendFile, mkdir, rename, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { AllConfigType } from '../config/config.type';
import {
  DEFAULT_HEATING_LOG_FILE,
  DEFAULT_HEATING_LOG_FILE_MAX_SIZE_MB,
} from './config/heating.config';

export type HeatingFileLogEvent =
  | 'HEATING_ERROR'
  | 'HEATING_RECOVERED'
  | 'HEATING_ERROR_CLEARED';

export interface HeatingFileLogEntry {
  event: HeatingFileLogEvent;
  summary: string;
  [key: string]: unknown;
}

/*
 * Ausführliches Diagnoseprotokoll der Heizungssteuerung als Datei
 * (HEATING_LOG_FILE, Default logs/heating.log).
 *
 * Das Aktivitätsprotokoll enthält nur eine kurze Zusammenfassung (Details
 * auf 300 Zeichen gekürzt). Hier landet pro Ereignis eine JSON-Zeile mit
 * allen Details: Fehlercode, Raum/Location/Thermostat, vollständige
 * Fehlermeldung inkl. Ursache und Stacktrace, betroffene und alle übrigen
 * Aktionen des Laufs sowie bei der Wiederherstellung Dauer und Anzahl der
 * fehlgeschlagenen Läufe.
 *
 * Überschreitet die Datei HEATING_LOG_FILE_MAX_SIZE_MB, wird sie nach
 * `<datei>.1` verschoben (eine ältere Generation wird dabei ersetzt).
 *
 * Schreibfehler werden nur im Server-Log gemeldet und nie an die
 * Heizungssteuerung weitergegeben.
 */
@Injectable()
export class HeatingFileLogService {
  private readonly logger = new Logger(HeatingFileLogService.name);

  private queue: Promise<void> = Promise.resolve();
  private preparedDirectory: string | null = null;
  private writeErrorReported = false;

  constructor(private readonly configService: ConfigService<AllConfigType>) {}

  /*
   * Hängt einen Eintrag an. Schreibvorgänge werden nacheinander ausgeführt,
   * damit die Reihenfolge in der Datei der Aufrufreihenfolge entspricht.
   * Das zurückgegebene Promise wird nie abgelehnt.
   */
  write(entry: HeatingFileLogEntry, at: Date = new Date()): Promise<void> {
    const file = this.getFile();

    if (!file) {
      return this.queue;
    }

    const line = `${JSON.stringify({
      timestamp: at.toISOString(),
      localTime: formatLocalTime(at),
      ...entry,
    })}\n`;

    this.queue = this.queue.then(() => this.append(file, line));

    return this.queue;
  }

  private async append(file: string, line: string): Promise<void> {
    try {
      const directory = dirname(file);

      if (this.preparedDirectory !== directory) {
        await mkdir(directory, { recursive: true });
        this.preparedDirectory = directory;
      }

      await this.rotateIfNeeded(file);
      await appendFile(file, line, 'utf8');

      if (this.writeErrorReported) {
        this.writeErrorReported = false;
        this.logger.log(`Heating log file ${file} is writable again`);
      }
    } catch (error) {
      // Verzeichnis ggf. gelöscht: beim nächsten Mal erneut anlegen.
      this.preparedDirectory = null;

      // Nur einmal melden, statt bei jedem Eintrag.
      if (!this.writeErrorReported) {
        this.writeErrorReported = true;
        this.logger.error(
          `Heating log file ${file} could not be written: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }

  private async rotateIfNeeded(file: string): Promise<void> {
    const maxBytes = this.getMaxSizeMb() * 1024 * 1024;

    if (maxBytes <= 0) {
      return;
    }

    let size: number;

    try {
      size = (await stat(file)).size;
    } catch {
      return;
    }

    if (size >= maxBytes) {
      await rename(file, `${file}.1`);
    }
  }

  private getFile(): string | null {
    const config = this.configService.get('heating', { infer: true });
    // null = per HEATING_LOG_FILE=false abgeschaltet
    const file =
      config?.logFile === undefined ? DEFAULT_HEATING_LOG_FILE : config.logFile;

    return file ? resolve(file) : null;
  }

  private getMaxSizeMb(): number {
    return (
      this.configService.get('heating', { infer: true })?.logFileMaxSizeMb ??
      DEFAULT_HEATING_LOG_FILE_MAX_SIZE_MB
    );
  }
}

/*
 * Lokale Zeit des Prozesses (TZ) inkl. UTC-Offset, z. B.
 * "2026-09-28 10:57:01 +02:00", damit die Einträge direkt mit den
 * Terminzeiten verglichen werden können.
 */
export function formatLocalTime(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const absOffset = Math.abs(offset);

  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())} ` +
    `${sign}${pad(Math.floor(absOffset / 60))}:${pad(absOffset % 60)}`
  );
}
