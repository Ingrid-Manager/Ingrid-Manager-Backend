import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';

import { AllConfigType } from '../config/config.type';
import { RoomsService } from '../rooms/rooms.service';
import { Room } from '../rooms/infrastructure/relational/persistence/entities/room.entity';
import { CalendarEventsService } from '../calendar-events/calendar-events.service';
import { CalendarEvent } from '../calendar-events/infrastructure/relational/persistence/entities/calendar-event.entity';
import { HeatingService } from './heating.service';
import {
  HeatingAuditLabels,
  HeatingAuditService,
} from './heating-audit.service';
import { HeatingConfig } from './config/heating-config.type';
import { HeatingAction, HeatingActionResult } from './domain/heating-action';
import {
  HeatingError,
  HeatingErrorCode,
  toHeatingError,
} from './domain/heating-error';
import {
  HeatingEvent,
  HeatingRoom,
  eventWindow,
  planHeating,
  planSeasonExit,
} from './domain/heating-rules';
import { isInSeason, parseHeatingSeason } from './domain/heating-season';

export const HEATING_CLOCK = Symbol('HEATING_CLOCK');
export const HEATING_CRON_JOB = 'heating-control';

export interface HeatingClock {
  now(): Date;
}

export const systemClock: HeatingClock = {
  now: () => new Date(),
};

export interface HeatingRunResult {
  now: Date;
  inSeason: boolean | null;
  actions: HeatingAction[];
  results: HeatingActionResult[];
  errors: HeatingError[];
  /* Anzeigenamen für das Aktivitätsprotokoll */
  labels: HeatingAuditLabels;
}

/*
 * Zentraler Scheduler der kalendergesteuerten Raumheizung.
 *
 * Läuft genau einmal pro Minute für alle Locations. Pro Lauf:
 *
 *   1. Season Check (außerhalb der Saison nur einmaliges Absenken)
 *   2. Aktive Kalendertermine laden
 *   3. Termine den Räumen / Locations zuordnen
 *   4. Heizregel je Raum auswerten (HEAT / COOL / BRIDGE, e*)
 *   5. Flur-Sonderregel je Location
 *   6. Heizaktionen nach Location gruppieren
 *   7. Aktionen über den HeatingService (FRITZ!Box der Location) ausführen
 *      und den neuen Raumzustand (heated) persistieren
 *   8. Fehler einer Location blockieren andere Locations nicht
 *   9. Zustandswechsel und Fehler ins Aktivitätsprotokoll schreiben
 */
@Injectable()
export class HeatingScheduler implements OnModuleDestroy {
  private readonly logger = new Logger(HeatingScheduler.name);

  private currentRun: Promise<HeatingRunResult> | null = null;
  private rerunRequested = false;
  private stopping = false;
  private readonly reportedConfigErrors = new Set<string>();

  constructor(
    private readonly configService: ConfigService<AllConfigType>,
    private readonly roomsService: RoomsService,
    private readonly calendarEventsService: CalendarEventsService,
    private readonly heatingService: HeatingService,
    @Inject(HEATING_CLOCK)
    private readonly clock: HeatingClock,
    private readonly heatingAudit: HeatingAuditService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE, { name: HEATING_CRON_JOB })
  async handleCron(): Promise<void> {
    if (this.stopping || !this.getConfig().schedulerEnabled) {
      return;
    }

    await this.trigger();
  }

  /*
   * Graceful Shutdown: Ein laufender Heizlauf wird noch abgeschlossen, bevor
   * die FRITZ!Box-Verbindungen (FritzBoxConnectionManager, erst in
   * beforeApplicationShutdown) und die Datenbank geschlossen werden. Danach
   * startet kein weiterer Lauf mehr.
   */
  async onModuleDestroy(): Promise<void> {
    this.stopping = true;
    this.rerunRequested = false;

    if (this.currentRun) {
      this.logger.log('Waiting for the running heating run before shutdown');
      await this.currentRun.catch(() => undefined);
    }
  }

  /*
   * Startet einen Lauf. Läuft bereits ein Lauf, wird kein zweiter parallel
   * gestartet: stattdessen wird nach dessen Abschluss genau ein weiterer
   * Lauf (mit aktueller Uhrzeit) nachgeholt.
   */
  trigger(): Promise<HeatingRunResult> {
    if (this.currentRun) {
      this.rerunRequested = true;
      this.logger.warn(
        'Previous heating run is still in progress, next run is queued',
      );

      return this.currentRun;
    }

    this.currentRun = this.runQueued().finally(() => {
      this.currentRun = null;
    });

    return this.currentRun;
  }

  isRunning(): boolean {
    return this.currentRun !== null;
  }

  private async runQueued(): Promise<HeatingRunResult> {
    let result = await this.run(this.clock.now());

    while (this.rerunRequested && !this.stopping) {
      this.rerunRequested = false;
      result = await this.run(this.clock.now());
    }

    return result;
  }

  /*
   * Ein vollständiger Lauf der Heizungssteuerung zum Zeitpunkt `now`.
   * Wirft nie; alle Fehler werden protokolliert und im Ergebnis geliefert.
   */
  async run(now: Date): Promise<HeatingRunResult> {
    const result: HeatingRunResult = {
      now,
      inSeason: null,
      actions: [],
      results: [],
      errors: [],
      labels: { rooms: new Map(), locations: new Map(), events: new Map() },
    };

    await this.execute(now, result);

    // 9. Zustandswechsel und Fehler ins Aktivitätsprotokoll schreiben
    try {
      await this.heatingAudit.record(result);
    } catch (error) {
      this.logger.error(
        `Heating audit log could not be written: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    return result;
  }

  private async execute(now: Date, result: HeatingRunResult): Promise<void> {
    try {
      const config = this.getConfig();

      // 1. Season Check
      const season = parseHeatingSeason(config.seasonStart, config.seasonEnd);

      if (!season) {
        this.reportConfigError(
          result,
          `HEATING_SEASON_START/HEATING_SEASON_END are missing or invalid ` +
            `(got "${config.seasonStart ?? ''}" / "${config.seasonEnd ?? ''}", expected MM-DD)`,
        );
      } else {
        result.inSeason = isInSeason(now, season);
      }

      const rooms = await this.loadRooms(result.labels);

      if (!season || !result.inSeason) {
        // Ohne gültige Heizsaison wird nie geheizt: noch als beheizt
        // markierte Räume werden (wie beim Saisonende) abgesenkt, damit
        // sie nicht dauerhaft warm bleiben.
        // Einmaliges Absenken beim Verlassen der Heizsaison (idempotent über
        // den persistierten heated-Zustand).
        result.actions = planSeasonExit(rooms);
      } else {
        // 2. Aktive Termine laden
        const window = eventWindow(rooms, now);
        const events = await this.loadEvents(
          window.from,
          window.to,
          result.labels,
        );

        // 3.-5. Zuordnung, Raumregeln, Flur-Sonderregel
        const plan = planHeating({
          now,
          rooms,
          events,
          hallways: this.resolveHallways(config, rooms, result),
        });

        for (const eventId of plan.unknownRoomEventIds) {
          this.recordError(
            result,
            new HeatingError(
              HeatingErrorCode.UNKNOWN_ROOM,
              `Calendar event ${eventId} references an unknown room`,
            ),
            'warn',
          );
        }

        result.actions = plan.actions;
      }

      // 6.-8. Gruppieren und pro Location isoliert ausführen
      result.results = await this.executeActions(result.actions, result);
    } catch (error) {
      this.recordError(
        result,
        toHeatingError(error, HeatingErrorCode.DATA_SOURCE_ERROR),
      );
    }
  }

  private async executeActions(
    actions: HeatingAction[],
    result: HeatingRunResult,
  ): Promise<HeatingActionResult[]> {
    const byLocation = new Map<number, HeatingAction[]>();

    for (const action of actions) {
      const list = byLocation.get(action.locationId) ?? [];
      list.push(action);
      byLocation.set(action.locationId, list);
    }

    const perLocation = await Promise.all(
      [...byLocation].map(([locationId, locationActions]) =>
        this.executeLocation(locationId, locationActions, result),
      ),
    );

    return perLocation.flat();
  }

  private async executeLocation(
    locationId: number,
    actions: HeatingAction[],
    result: HeatingRunResult,
  ): Promise<HeatingActionResult[]> {
    let results: HeatingActionResult[];

    try {
      results = await this.heatingService.executeLocationActions(
        locationId,
        actions,
      );
    } catch (error) {
      const heatingError = toHeatingError(
        error,
        HeatingErrorCode.FRITZBOX_UNREACHABLE,
        { locationId },
      );
      results = actions.map((action) => ({
        action,
        status: 'failed' as const,
        error: heatingError,
      }));
    }

    const reported = new Set<Error>();

    for (const actionResult of results) {
      if (actionResult.status === 'failed') {
        // Ein Verbindungsfehler betrifft alle Aktionen der Location, wird
        // aber nur einmal protokolliert.
        if (!reported.has(actionResult.error)) {
          reported.add(actionResult.error);
          this.recordError(
            result,
            toHeatingError(
              actionResult.error,
              HeatingErrorCode.THERMOSTAT_UNREACHABLE,
              {
                locationId,
                roomId: actionResult.action.roomId,
                avmId: actionResult.action.avmId,
              },
            ),
          );
        }

        // Zustand bleibt unverändert -> wird im nächsten Lauf erneut versucht
        continue;
      }

      try {
        await this.roomsService.setHeated(
          actionResult.action.roomId,
          actionResult.action.action === 'HEAT',
        );
      } catch (error) {
        this.recordError(
          result,
          toHeatingError(error, HeatingErrorCode.DATA_SOURCE_ERROR, {
            locationId,
            roomId: actionResult.action.roomId,
          }),
        );
      }
    }

    return results;
  }

  /*
   * Ordnet die konfigurierten Flur-Räume (HEATING_HALLWAY_ROOM_ID) über ihre
   * locationid genau einer Location zu.
   */
  private resolveHallways(
    config: HeatingConfig,
    rooms: HeatingRoom[],
    result: HeatingRunResult,
  ): Map<number, number> {
    const roomsById = new Map(rooms.map((room) => [room.id, room]));
    const hallways = new Map<number, number>();
    const ambiguous = new Set<number>();

    for (const roomId of config.hallwayRoomIds ?? []) {
      const room = roomsById.get(roomId);

      if (!room) {
        this.recordError(
          result,
          new HeatingError(
            HeatingErrorCode.UNKNOWN_ROOM,
            `Hallway room ${roomId} (HEATING_HALLWAY_ROOM_ID) does not exist`,
            { roomId },
          ),
          'warn',
        );
        continue;
      }

      const existing = hallways.get(room.locationId);

      if (existing !== undefined && existing !== roomId) {
        ambiguous.add(room.locationId);
        continue;
      }

      hallways.set(room.locationId, roomId);
    }

    for (const locationId of ambiguous) {
      hallways.delete(locationId);
      this.reportConfigError(
        result,
        `HEATING_HALLWAY_ROOM_ID contains more than one hallway for location ${locationId}; hallway rule is disabled for this location`,
        { locationId },
      );
    }

    return hallways;
  }

  private async loadRooms(labels: HeatingAuditLabels): Promise<HeatingRoom[]> {
    let rooms: Room[];

    try {
      rooms = await this.roomsService.findAllForHeating();
    } catch (error) {
      throw new HeatingError(
        HeatingErrorCode.DATA_SOURCE_ERROR,
        'Rooms could not be loaded',
        {},
        error,
      );
    }

    for (const room of rooms) {
      labels.rooms.set(room.id, room.title);

      if (room.location?.title) {
        labels.locations.set(room.locationid, room.location.title);
      }
    }

    return rooms.map((room) => ({
      id: room.id,
      locationId: room.locationid,
      prelimTime: Number(room.prelim_time) || 0,
      comfortTemp: Number(room.comfort_temp),
      emptyTemp: Number(room.empty_temp),
      heated: Boolean(room.heated),
      avmId: room.avm_id ?? null,
    }));
  }

  private async loadEvents(
    from: Date,
    to: Date,
    labels: HeatingAuditLabels,
  ): Promise<HeatingEvent[]> {
    let events: CalendarEvent[];

    try {
      events = await this.calendarEventsService.findActiveHeatingEvents(
        from,
        to,
      );
    } catch (error) {
      throw new HeatingError(
        HeatingErrorCode.DATA_SOURCE_ERROR,
        'Calendar events could not be loaded',
        {},
        error,
      );
    }

    for (const event of events) {
      labels.events.set(event.id, event.title);
    }

    return events
      .filter((event) => event.roomid !== null && event.roomid !== undefined)
      .map((event) => ({
        id: event.id,
        roomId: event.roomid,
        start: new Date(event.start),
        end: new Date(event.end),
      }))
      .filter(
        (event) =>
          !Number.isNaN(event.start.getTime()) &&
          !Number.isNaN(event.end.getTime()),
      );
  }

  private getConfig(): HeatingConfig {
    return (
      this.configService.get('heating', { infer: true }) ?? {
        hallwayRoomIds: [],
        schedulerEnabled: true,
      }
    );
  }

  /*
   * Konfigurationsfehler ändern sich zur Laufzeit nicht und werden daher nur
   * einmal (und nicht jede Minute) als Fehler protokolliert.
   */
  private reportConfigError(
    result: HeatingRunResult,
    message: string,
    context: { locationId?: number } = {},
  ) {
    const error = new HeatingError(
      HeatingErrorCode.CONFIGURATION_ERROR,
      message,
      context,
    );
    const alreadyReported = this.reportedConfigErrors.has(message);

    this.reportedConfigErrors.add(message);
    this.recordError(result, error, alreadyReported ? 'debug' : 'error');
  }

  private recordError(
    result: HeatingRunResult,
    error: HeatingError,
    level: 'error' | 'warn' | 'debug' = 'error',
  ) {
    result.errors.push(error);

    const message = error.toLogMessage();

    if (level === 'error') {
      this.logger.error(message);
    } else if (level === 'warn') {
      this.logger.warn(message);
    } else {
      this.logger.debug(message);
    }
  }
}
