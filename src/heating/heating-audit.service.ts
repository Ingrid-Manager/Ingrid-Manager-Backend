import { Injectable } from '@nestjs/common';

import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditAction } from '../audit-log/audit-action.enum';
import { AuditService } from '../audit-log/audit-service.enum';
import { AuditEntityType } from '../audit-log/audit-entity-type.enum';
import {
  HeatingAction,
  HeatingActionReason,
  HeatingActionResult,
} from './domain/heating-action';
import { HeatingError, HeatingErrorCode } from './domain/heating-error';

/*
 * Anzeigenamen für die Einträge im Aktivitätsprotokoll.
 */
export interface HeatingAuditLabels {
  rooms: Map<number, string>;
  locations: Map<number, string>;
  events: Map<number, string>;
}

export interface HeatingAuditInput {
  results: HeatingActionResult[];
  errors: HeatingError[];
  labels: HeatingAuditLabels;
}

/* Fehler, die die gesamte FRITZ!Box-Verbindung einer Location betreffen */
const LOCATION_ERROR_CODES = new Set<HeatingErrorCode>([
  HeatingErrorCode.FRITZBOX_UNREACHABLE,
  HeatingErrorCode.UNKNOWN_LOCATION,
  HeatingErrorCode.MISSING_FRITZBOX_MAPPING,
]);

const MAX_DETAIL_LENGTH = 300;

interface ActiveError {
  code: HeatingErrorCode;
  locationId?: number;
  roomId?: number;
}

/*
 * Schreibt die Ergebnisse der automatischen Heizungssteuerung in das
 * Aktivitätsprotokoll (audit_log):
 *
 *   ROOM_HEATED        Raum "xy" wurde aufgeheizt
 *   ROOM_COOLED        Raum "xy" wurde abgesenkt
 *   HEATING_ERROR      Befehl / FRITZ!Box / Thermostat fehlgeschlagen
 *   HEATING_RECOVERED  FRITZ!Box bzw. Thermostat wieder erreichbar
 *
 * Da der Scheduler fehlgeschlagene Befehle jede Minute wiederholt, wird ein
 * Fehler nur beim ersten Auftreten protokolliert und erst dann erneut, wenn
 * er zwischenzeitlich verschwunden war. Der Zustand wird im Speicher
 * gehalten; nach einem Neustart wird ein fortbestehender Fehler daher einmal
 * erneut protokolliert.
 */
@Injectable()
export class HeatingAuditService {
  private active = new Map<string, ActiveError>();

  constructor(private readonly auditLogService: AuditLogService) {}

  async record(input: HeatingAuditInput): Promise<void> {
    const { results, errors, labels } = input;
    const seen = new Map<string, ActiveError>();

    // 1. Erfolgreiche Zustandswechsel
    const recoveredLocations = new Set<number>();
    const recoveredRooms = new Set<number>();

    for (const result of results) {
      if (result.status === 'failed') {
        continue;
      }

      await this.logStateChange(result, labels);

      if (result.status === 'applied') {
        recoveredLocations.add(result.action.locationId);
        recoveredRooms.add(result.action.roomId);
      }
    }

    // 2. Wiederherstellung bisher aktiver Fehler
    for (const [key, error] of this.active) {
      const recovered = LOCATION_ERROR_CODES.has(error.code)
        ? recoveredLocations.has(error.locationId)
        : error.roomId !== undefined && recoveredRooms.has(error.roomId);

      if (!recovered) {
        continue;
      }

      this.active.delete(key);
      await this.logRecovery(error, labels);
    }

    // 3. Neue Fehler (jeder Fehler nur einmal, solange er besteht)
    for (const error of unique(errors)) {
      const activeError = toActiveError(error);
      const key = errorKey(error);

      seen.set(key, activeError);

      if (this.active.has(key)) {
        continue;
      }

      await this.logError(error, results, labels);
    }

    // Fehler, die in diesem Lauf nicht mehr auftreten (z. B. weil keine
    // Aktion mehr nötig war), werden verworfen, damit ein erneutes
    // Auftreten später wieder protokolliert wird.
    this.active = seen;
  }

  private async logStateChange(
    result: HeatingActionResult,
    labels: HeatingAuditLabels,
  ) {
    const { action } = result;
    const heated = action.action === 'HEAT';
    const room = roomLabel(action.roomId, labels);
    const location = locationLabel(action.locationId, labels);
    const verb = heated ? 'aufgeheizt' : 'abgesenkt';
    const noDevice =
      result.status === 'skipped'
        ? ' - kein Thermostat hinterlegt, nur Status geändert'
        : '';

    await this.auditLogService.log({
      user: null,
      action: heated ? AuditAction.ROOM_HEATED : AuditAction.ROOM_COOLED,
      service: AuditService.HEATING,
      entityType: AuditEntityType.ROOM,
      entityId: action.roomId,
      summary:
        `Raum "${room}" (${location}) wurde ${verb} auf ` +
        `${formatTemperature(action.targetTemperature)} ` +
        `(${reasonText(action, labels)})${noDevice}`,
      changes: {
        heated: { old: !heated, new: heated },
        targetTemperature: { old: null, new: action.targetTemperature },
      },
    });
  }

  private async logError(
    error: HeatingError,
    results: HeatingActionResult[],
    labels: HeatingAuditLabels,
  ) {
    const failedActions = results
      .filter((result) => result.status === 'failed' && result.error === error)
      .map((result) => result.action);

    const affected = failedActions.length
      ? ` - betroffen: ${failedActions
          .map(
            (action) =>
              `"${roomLabel(action.roomId, labels)}" (${actionText(action)})`,
          )
          .join(', ')}`
      : '';

    const isLocationError =
      LOCATION_ERROR_CODES.has(error.code) ||
      (error.context.roomId === undefined &&
        error.context.locationId !== undefined);

    await this.auditLogService.log({
      user: null,
      action: AuditAction.HEATING_ERROR,
      service: AuditService.HEATING,
      entityType: isLocationError
        ? AuditEntityType.AVM_LOCATION
        : error.context.roomId !== undefined
          ? AuditEntityType.ROOM
          : AuditEntityType.SYSTEM,
      entityId: isLocationError
        ? (error.context.locationId ?? null)
        : (error.context.roomId ?? null),
      summary: `${errorText(error, labels)}${affected}`,
      changes: {
        errorCode: { old: null, new: error.code },
        detail: { old: null, new: errorDetail(error) },
      },
    });
  }

  private async logRecovery(error: ActiveError, labels: HeatingAuditLabels) {
    const isLocationError = LOCATION_ERROR_CODES.has(error.code);
    const location = locationLabel(error.locationId, labels);
    const summary =
      error.code === HeatingErrorCode.FRITZBOX_UNREACHABLE
        ? `FRITZ!Box der Location "${location}" ist wieder erreichbar, Heizbefehle werden wieder ausgeführt`
        : isLocationError
          ? `Heizbefehle für Location "${location}" werden wieder ausgeführt`
          : `Heizbefehle für Raum "${roomLabel(error.roomId, labels)}" werden wieder ausgeführt`;

    await this.auditLogService.log({
      user: null,
      action: AuditAction.HEATING_RECOVERED,
      service: AuditService.HEATING,
      entityType: isLocationError
        ? AuditEntityType.AVM_LOCATION
        : AuditEntityType.ROOM,
      entityId: isLocationError ? error.locationId : error.roomId,
      summary,
      changes: {
        errorCode: { old: error.code, new: null },
      },
    });
  }
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function toActiveError(error: HeatingError): ActiveError {
  if (LOCATION_ERROR_CODES.has(error.code)) {
    return { code: error.code, locationId: error.context.locationId };
  }

  return {
    code: error.code,
    locationId: error.context.locationId,
    roomId: error.context.roomId,
  };
}

function errorKey(error: HeatingError): string {
  const { code, context } = error;

  if (LOCATION_ERROR_CODES.has(code)) {
    return `${code}|location:${context.locationId ?? '-'}`;
  }

  if (context.roomId !== undefined || context.locationId !== undefined) {
    return `${code}|location:${context.locationId ?? '-'}|room:${context.roomId ?? '-'}`;
  }

  // Fehler ohne Raum-/Location-Bezug (Konfiguration, Datenbank, Termine
  // mit unbekanntem Raum) werden über ihre Meldung unterschieden.
  return `${code}|${error.message}`;
}

function roomLabel(roomId: number | undefined, labels: HeatingAuditLabels) {
  if (roomId === undefined) {
    return 'unbekannt';
  }

  return labels.rooms.get(roomId) ?? `#${roomId}`;
}

function locationLabel(
  locationId: number | undefined,
  labels: HeatingAuditLabels,
) {
  if (locationId === undefined) {
    return 'unbekannte Location';
  }

  return labels.locations.get(locationId) ?? `Location #${locationId}`;
}

function formatTemperature(value: number): string {
  return `${String(value).replace('.', ',')} °C`;
}

function actionText(action: HeatingAction): string {
  const verb = action.action === 'HEAT' ? 'Aufheizen' : 'Absenken';

  return `${verb} auf ${formatTemperature(action.targetTemperature)}`;
}

const REASON_TEXTS: Record<HeatingActionReason, string> = {
  EVENT_PRELIM: 'Termin steht an bzw. läuft',
  EVENT_ENDED: 'Termin beendet',
  NO_ACTIVE_EVENT: 'kein aktiver oder anstehender Termin',
  HALLWAY_OCCUPIED: 'Flur: mindestens ein Raum ist beheizt',
  HALLWAY_EMPTY: 'Flur: kein weiterer Raum ist beheizt',
  SEASON_END: 'Ende der Heizsaison',
};

function reasonText(action: HeatingAction, labels: HeatingAuditLabels) {
  const text = REASON_TEXTS[action.reason] ?? action.reason;
  const eventTitle =
    action.eventId !== null && action.eventId !== undefined
      ? (labels.events.get(action.eventId) ?? `#${action.eventId}`)
      : null;

  return eventTitle ? `${text}: "${eventTitle}"` : text;
}

function errorText(error: HeatingError, labels: HeatingAuditLabels): string {
  const room = roomLabel(error.context.roomId, labels);
  const location = locationLabel(error.context.locationId, labels);

  switch (error.code) {
    case HeatingErrorCode.FRITZBOX_UNREACHABLE:
      return `Heizbefehle fehlgeschlagen: FRITZ!Box der Location "${location}" ist nicht erreichbar`;
    case HeatingErrorCode.THERMOSTAT_UNREACHABLE:
      return `Heizbefehl für Raum "${room}" fehlgeschlagen: Thermostat${
        error.context.avmId ? ` ${error.context.avmId}` : ''
      } ist nicht erreichbar oder unbekannt`;
    case HeatingErrorCode.INVALID_TEMPERATURE:
      return `Heizbefehl für Raum "${room}" fehlgeschlagen: ungültige Zieltemperatur`;
    case HeatingErrorCode.UNKNOWN_LOCATION:
      return `Heizbefehle fehlgeschlagen: ${location} existiert nicht`;
    case HeatingErrorCode.MISSING_FRITZBOX_MAPPING:
      return `Heizbefehle fehlgeschlagen: für Location "${location}" ist keine FRITZ!Box konfiguriert`;
    case HeatingErrorCode.UNKNOWN_ROOM:
      return `Heizungssteuerung: unbekannter Raum (${error.message})`;
    case HeatingErrorCode.CONFIGURATION_ERROR:
      return error.context.roomId !== undefined
        ? `Heizbefehl für Raum "${room}" fehlgeschlagen: Konfigurationsfehler`
        : `Heizungssteuerung: Konfigurationsfehler (${error.message})`;
    case HeatingErrorCode.DATA_SOURCE_ERROR:
      return `Heizungssteuerung: Kalender/Datenbank konnte nicht gelesen werden`;
    default:
      return `Heizungssteuerung: ${error.message}`;
  }
}

function errorDetail(error: HeatingError): string {
  const original =
    error.originalError instanceof Error
      ? ` (${error.originalError.name}: ${error.originalError.message})`
      : '';
  const detail = `${error.message}${original}`;

  return detail.length > MAX_DETAIL_LENGTH
    ? `${detail.slice(0, MAX_DETAIL_LENGTH - 1)}…`
    : detail;
}
