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
import { HeatingFileLogService } from './heating-file-log.service';

/*
 * Anzeigenamen für die Einträge im Aktivitätsprotokoll.
 */
export interface HeatingAuditLabels {
  rooms: Map<number, string>;
  locations: Map<number, string>;
  events: Map<number, string>;
}

export interface HeatingAuditInput {
  /* Zeitpunkt des Scheduler-Laufs (Default: jetzt) */
  now?: Date;
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
  /* Für das Datei-Protokoll: Thermostat und Verlauf des Fehlers */
  avmId?: string | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
  /* Anzahl der Läufe, in denen der Fehler aufgetreten ist */
  occurrences: number;
  lastMessage: string;
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
 *
 * Zusätzlich wird jeder HEATING_ERROR und HEATING_RECOVERED mit allen
 * Details in die Protokolldatei der Heizung geschrieben
 * (HeatingFileLogService). Verschwindet ein Fehler, ohne dass ein Befehl
 * erfolgreich war (z. B. weil keine Aktion mehr nötig ist), wird das dort
 * als HEATING_ERROR_CLEARED festgehalten.
 */
@Injectable()
export class HeatingAuditService {
  private active = new Map<string, ActiveError>();

  constructor(
    private readonly auditLogService: AuditLogService,
    private readonly fileLog: HeatingFileLogService,
  ) {}

  async record(input: HeatingAuditInput): Promise<void> {
    const { results, errors, labels } = input;
    const now = input.now ?? new Date();
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
      await this.logRecovery(error, labels, results, now);
    }

    // 3. Neue Fehler (jeder Fehler nur einmal, solange er besteht)
    for (const error of unique(errors)) {
      const key = errorKey(error);
      const previous = this.active.get(key);

      if (!seen.has(key)) {
        seen.set(
          key,
          previous
            ? {
                ...previous,
                lastSeenAt: now,
                occurrences: previous.occurrences + 1,
                lastMessage: error.toLogMessage(),
              }
            : toActiveError(error, now),
        );
      }

      if (previous) {
        continue;
      }

      await this.logError(error, results, labels, now);
    }

    // Fehler, die in diesem Lauf nicht mehr auftreten (z. B. weil keine
    // Aktion mehr nötig war), werden verworfen, damit ein erneutes
    // Auftreten später wieder protokolliert wird.
    for (const [key, error] of this.active) {
      if (!seen.has(key)) {
        await this.logCleared(error, labels, results, now);
      }
    }

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
    now: Date,
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

    const summary = `${errorText(error, labels)}${affected}`;

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
      summary,
      changes: {
        errorCode: { old: null, new: error.code },
        detail: { old: null, new: errorDetail(error) },
      },
    });

    await this.fileLog.write(
      {
        event: 'HEATING_ERROR',
        summary,
        code: error.code,
        message: error.message,
        ...contextDetails(error.context, labels),
        error: serializeError(error),
        affectedActions: failedActions.map((action) =>
          actionDetails(action, labels),
        ),
        run: runDetails(now, results, labels),
      },
      now,
    );
  }

  private async logRecovery(
    error: ActiveError,
    labels: HeatingAuditLabels,
    results: HeatingActionResult[],
    now: Date,
  ) {
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

    const recoveredBy = results
      .filter(
        (result) =>
          result.status === 'applied' &&
          (isLocationError
            ? result.action.locationId === error.locationId
            : result.action.roomId === error.roomId),
      )
      .map((result) => actionDetails(result.action, labels));

    await this.fileLog.write(
      {
        event: 'HEATING_RECOVERED',
        summary,
        ...historyDetails(error, labels, now),
        recoveredBy,
        run: runDetails(now, results, labels),
      },
      now,
    );
  }

  /*
   * Nur Datei-Protokoll: Der Fehler tritt nicht mehr auf, obwohl kein
   * Befehl für den betroffenen Raum bzw. die Location erfolgreich war -
   * typischerweise, weil die fehlgeschlagene Aktion nicht mehr nötig ist
   * (Termin vorbei, Raumzustand geändert, Konfiguration korrigiert). Der
   * gewünschte Heizzustand wurde dann möglicherweise nie erreicht.
   */
  private async logCleared(
    error: ActiveError,
    labels: HeatingAuditLabels,
    results: HeatingActionResult[],
    now: Date,
  ) {
    const target =
      error.roomId !== undefined && !LOCATION_ERROR_CODES.has(error.code)
        ? `Raum "${roomLabel(error.roomId, labels)}"`
        : `Location "${locationLabel(error.locationId, labels)}"`;

    await this.fileLog.write(
      {
        event: 'HEATING_ERROR_CLEARED',
        summary:
          `Fehler ${error.code} für ${target} tritt nicht mehr auf, ohne dass ` +
          `ein Heizbefehl erfolgreich war (Aktion nicht mehr erforderlich)`,
        ...historyDetails(error, labels, now),
        run: runDetails(now, results, labels),
      },
      now,
    );
  }
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function toActiveError(error: HeatingError, now: Date): ActiveError {
  const history = {
    firstSeenAt: now,
    lastSeenAt: now,
    occurrences: 1,
    lastMessage: error.toLogMessage(),
  };

  if (LOCATION_ERROR_CODES.has(error.code)) {
    return {
      code: error.code,
      locationId: error.context.locationId,
      ...history,
    };
  }

  return {
    code: error.code,
    locationId: error.context.locationId,
    roomId: error.context.roomId,
    avmId: error.context.avmId,
    ...history,
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

/*
 * Details für das Datei-Protokoll
 */

function contextDetails(
  context: { locationId?: number; roomId?: number; avmId?: string | null },
  labels: HeatingAuditLabels,
) {
  return {
    location:
      context.locationId === undefined
        ? null
        : {
            id: context.locationId,
            title: labels.locations.get(context.locationId) ?? null,
          },
    room:
      context.roomId === undefined
        ? null
        : {
            id: context.roomId,
            title: labels.rooms.get(context.roomId) ?? null,
          },
    avmId: context.avmId ?? null,
  };
}

function actionDetails(action: HeatingAction, labels: HeatingAuditLabels) {
  return {
    action: action.action,
    reason: action.reason,
    reasonText: reasonText(action, labels),
    room: { id: action.roomId, title: labels.rooms.get(action.roomId) ?? null },
    locationId: action.locationId,
    avmId: action.avmId,
    targetTemperature: action.targetTemperature,
    event:
      action.eventId === null || action.eventId === undefined
        ? null
        : {
            id: action.eventId,
            title: labels.events.get(action.eventId) ?? null,
          },
  };
}

/* Alle Aktionen des Laufs mit Ergebnis, um den Zusammenhang nachzuvollziehen */
function runDetails(
  now: Date,
  results: HeatingActionResult[],
  labels: HeatingAuditLabels,
) {
  return {
    at: now.toISOString(),
    actions: results.map((result) => ({
      ...actionDetails(result.action, labels),
      status: result.status,
      error: result.error ? result.error.message : null,
    })),
  };
}

function historyDetails(
  error: ActiveError,
  labels: HeatingAuditLabels,
  now: Date,
) {
  return {
    code: error.code,
    ...contextDetails(
      {
        locationId: error.locationId,
        roomId: error.roomId,
        avmId: error.avmId,
      },
      labels,
    ),
    firstSeenAt: error.firstSeenAt.toISOString(),
    lastSeenAt: error.lastSeenAt.toISOString(),
    durationMinutes:
      Math.round(
        ((now.getTime() - error.firstSeenAt.getTime()) / 60_000) * 10,
      ) / 10,
    failedRuns: error.occurrences,
    lastMessage: error.lastMessage,
  };
}

/* Vollständige Fehlerkette (Meldung, Stacktrace, Ursachen) ohne Kürzung */
function serializeError(error: unknown, depth = 0): unknown {
  if (!(error instanceof Error)) {
    return error === undefined ? null : String(error);
  }

  const details: Record<string, unknown> = {
    name: error.name,
    message: error.message,
    stack: error.stack ?? null,
  };

  // Technischer Code der Ursache, z. B. ECONNREFUSED (HeatingError: s. o.)
  const code = (error as { code?: unknown }).code;
  if (code !== undefined && !(error instanceof HeatingError)) {
    details.code = code;
  }

  if (depth < 3) {
    if (error instanceof HeatingError && error.originalError !== undefined) {
      details.originalError = serializeError(error.originalError, depth + 1);
    }

    const cause = (error as { cause?: unknown }).cause;
    if (cause !== undefined) {
      details.cause = serializeError(cause, depth + 1);
    }
  }

  return details;
}
