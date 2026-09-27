import { ConflictException, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AllConfigType } from '../config/config.type';
import { HeatingConfig } from './config/heating-config.type';
import { Room } from '../rooms/infrastructure/relational/persistence/entities/room.entity';
import { CalendarEvent } from '../calendar-events/infrastructure/relational/persistence/entities/calendar-event.entity';
import {
  BRIDGE_MINUTES,
  COOL_WINDOW_MINUTES,
  HeatingAction,
  HeatingDecision,
  HeatingEventInput,
  evaluateHallway,
  evaluateOutOfSeason,
  evaluateRoom,
  isInSeason,
} from './domain/heating-rules';
import {
  HEATING_COMMAND_DISPATCHER,
  HeatingCommandDispatcher,
} from './dispatcher/heating-command-dispatcher';
import {
  HeatingRoomResultDto,
  HeatingRunResultDto,
} from './application/dto/heating-run-result.dto';
import { HeatingStatusDto } from './application/dto/heating-status.dto';
import { AuditLogService, AuditLogUser } from '../audit-log/audit-log.service';
import { AuditAction } from '../audit-log/audit-action.enum';
import { AuditEntityType } from '../audit-log/audit-entity-type.enum';
import { AuditService } from '../audit-log/audit-service.enum';

export interface HeatingRunOptions {
  /** Nur auswerten, weder Zustand speichern noch Befehle senden. */
  dryRun?: boolean;
  /** Auslösender User bei manuellem Lauf (für das Audit-Log). */
  user?: AuditLogUser | null;
}

@Injectable()
export class HeatingRulesService {
  private readonly logger = new Logger(HeatingRulesService.name);
  private running = false;

  constructor(
    @InjectRepository(Room)
    private readonly roomRepo: Repository<Room>,
    @InjectRepository(CalendarEvent)
    private readonly eventRepo: Repository<CalendarEvent>,
    @Inject(HEATING_COMMAND_DISPATCHER)
    private readonly dispatcher: HeatingCommandDispatcher,
    private readonly configService: ConfigService<AllConfigType>,
    private readonly auditLogService: AuditLogService,
  ) {}

  private get config(): HeatingConfig {
    return this.configService.getOrThrow('heating', { infer: true });
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async runScheduled(): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    // Überlappende Läufe vermeiden, falls ein Lauf (z. B. wegen einer
    // langsamen Fritzbox) länger als eine Minute dauert.
    if (this.running) {
      this.logger.warn('Vorheriger Heizlauf noch aktiv, überspringe');
      return;
    }

    try {
      await this.run(new Date());
    } catch (error) {
      this.logger.error('Heizlauf fehlgeschlagen', error as Error);
    }
  }

  /**
   * Stellt sicher, dass nie zwei schreibende Läufe (Cron, manueller Lauf,
   * Initialisierung) gleichzeitig Befehle senden und `heated` speichern.
   */
  private async exclusive<T>(fn: () => Promise<T>): Promise<T> {
    if (this.running) {
      throw new ConflictException(
        'Es läuft bereits eine Heizungsauswertung, bitte später erneut versuchen.',
      );
    }

    this.running = true;
    try {
      return await fn();
    } finally {
      this.running = false;
    }
  }

  async getStatus(now: Date = new Date()): Promise<HeatingStatusDto> {
    const { enabled, seasonStart, seasonEnd, hallwayRoomId } = this.config;
    const rooms = await this.roomRepo.find({ order: { id: 'ASC' } });

    return {
      enabled,
      seasonStart,
      seasonEnd,
      inSeason: isInSeason(now, { start: seasonStart, end: seasonEnd }),
      hallwayRoomId,
      rooms: rooms.map((room) => ({
        roomId: room.id,
        title: room.title,
        avmId: room.avm_id ?? null,
        heated: room.heated,
        isHallway: room.id === hallwayRoomId,
      })),
    };
  }

  /**
   * Ablauf gesamt:
   *  0. Season-Check (außerhalb nur einmaliges Absenken beim Season-Exit)
   *  1. Aktive Termine laden
   *  2. Normale Räume auswerten (HEAT/COOL inkl. BRIDGE, spätester e*)
   *  3. Flur-Sonderregel auf Basis des aktualisierten |H|
   */
  run(
    now: Date,
    options: HeatingRunOptions = {},
  ): Promise<HeatingRunResultDto> {
    // Die Vorschau (dryRun) schreibt nichts und braucht keine Sperre.
    return options.dryRun
      ? this.evaluate(now, options)
      : this.exclusive(() => this.evaluate(now, options));
  }

  private async evaluate(
    now: Date,
    options: HeatingRunOptions,
  ): Promise<HeatingRunResultDto> {
    const dryRun = options.dryRun ?? false;
    const { seasonStart, seasonEnd, hallwayRoomId } = this.config;
    const inSeason = isInSeason(now, { start: seasonStart, end: seasonEnd });

    const rooms = await this.roomRepo.find({ order: { id: 'ASC' } });
    const results: HeatingRoomResultDto[] = [];

    if (!inSeason) {
      for (const room of rooms) {
        results.push(
          await this.apply(
            room,
            evaluateOutOfSeason(room),
            room.id === hallwayRoomId,
            dryRun,
            options.user,
          ),
        );
      }
      return { evaluatedAt: now, dryRun, inSeason, rooms: results };
    }

    const events = await this.loadActiveEvents(rooms, now);

    const hallway = rooms.find((room) => room.id === hallwayRoomId) ?? null;
    if (hallwayRoomId !== null && !hallway) {
      this.logger.warn(
        `HEATING_HALLWAY_ROOM_ID=${hallwayRoomId} verweist auf keinen Raum, Flur-Sonderregel entfällt`,
      );
    }

    for (const room of rooms) {
      if (room === hallway) {
        continue;
      }
      const roomEvents = events.filter((event) => event.roomid === room.id);
      results.push(
        await this.apply(
          room,
          evaluateRoom(room, roomEvents, now),
          false,
          dryRun,
          options.user,
        ),
      );
    }

    if (hallway) {
      // `rooms` enthält nach apply() bereits den aktualisierten heated-Stand
      // (bei dryRun den hypothetischen), so dass |H| korrekt gezählt wird.
      const decision = evaluateHallway(hallway, rooms, events, now);
      results.push(
        await this.apply(hallway, decision, true, dryRun, options.user),
      );
    }

    return { evaluatedAt: now, dryRun, inSeason, rooms: results };
  }

  /**
   * Initialzustand herstellen: Alle Räume auf empty_temp absenken und
   * heated = false setzen (z. B. einmalig beim Rollout).
   */
  initialize(
    user?: AuditLogUser | null,
    now: Date = new Date(),
  ): Promise<HeatingRunResultDto> {
    return this.exclusive(() => this.initializeRooms(user, now));
  }

  private async initializeRooms(
    user: AuditLogUser | null | undefined,
    now: Date,
  ): Promise<HeatingRunResultDto> {
    const { hallwayRoomId } = this.config;
    const rooms = await this.roomRepo.find({ order: { id: 'ASC' } });
    const results: HeatingRoomResultDto[] = [];

    for (const room of rooms) {
      // apply() prüft den bisherigen Zustand nicht, daher wird der
      // Absenk-Befehl unabhängig von `heated` gesendet.
      results.push(
        await this.apply(
          room,
          {
            action: HeatingAction.COOL,
            event: null,
            reason: 'Initialisierung (alle Räume absenken)',
          },
          room.id === hallwayRoomId,
          false,
          user,
        ),
      );
    }

    return { evaluatedAt: now, dryRun: false, inSeason: true, rooms: results };
  }

  /**
   * Aktive Termine (nicht gelöscht, kein Hintergrund), die für die
   * Auswertung relevant sein können: Terminende höchstens 5 Minuten her,
   * Terminbeginn innerhalb der größten Vorlaufzeit bzw. des
   * Bridging-Fensters.
   */
  private async loadActiveEvents(
    rooms: Room[],
    now: Date,
  ): Promise<HeatingEventInput[]> {
    const horizonMinutes = Math.max(
      BRIDGE_MINUTES,
      ...rooms.map((room) => room.prelim_time ?? 0),
    );
    const endAfter = new Date(now.getTime() - COOL_WINDOW_MINUTES * 60_000);
    const startBefore = new Date(now.getTime() + horizonMinutes * 60_000);

    const events = await this.eventRepo
      .createQueryBuilder('event')
      .where('event.isBackground = false')
      .andWhere('event.deletedAt IS NULL')
      .andWhere('event.end > :endAfter', { endAfter })
      .andWhere('event.start <= :startBefore', { startBefore })
      .orderBy('event.start', 'ASC')
      .getMany();

    return events.map((event) => ({
      id: event.id,
      title: event.title,
      roomid: event.roomid,
      start: new Date(event.start),
      end: new Date(event.end),
    }));
  }

  /**
   * Setzt eine Entscheidung um: Befehl an den Dispatcher, danach
   * `heated` speichern. Schlägt der Befehl fehl, bleibt der Zustand
   * unverändert, damit der nächste Lauf es erneut versucht.
   * Mutiert `room.heated`, damit Folgeauswertungen (Flur) den neuen
   * Stand sehen.
   */
  private async apply(
    room: Room,
    decision: HeatingDecision,
    isHallway: boolean,
    dryRun: boolean,
    user?: AuditLogUser | null,
  ): Promise<HeatingRoomResultDto> {
    const heatedBefore = room.heated;
    const result: HeatingRoomResultDto = {
      roomId: room.id,
      title: room.title,
      isHallway,
      heatedBefore,
      heatedAfter: heatedBefore,
      action: decision.action,
      targetTemperature: null,
      eventId: decision.event?.id ?? null,
      reason: decision.reason,
      status: null,
    };

    if (!decision.action) {
      return result;
    }

    const heatedAfter = decision.action === HeatingAction.HEAT;
    const targetTemperature = heatedAfter ? room.comfort_temp : room.empty_temp;
    result.targetTemperature = targetTemperature;

    const avmId = room.avm_id?.trim() || null;

    if (dryRun) {
      room.heated = heatedAfter;
      result.heatedAfter = heatedAfter;
      result.status = avmId ? 'planned' : 'skipped';
      return result;
    }

    if (avmId) {
      try {
        await this.dispatcher.dispatch({
          action: decision.action,
          roomId: room.id,
          roomTitle: room.title,
          avmId,
          locationId: room.locationid,
          targetTemperature,
          eventId: result.eventId,
          reason: decision.reason,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Schaltbefehl "${decision.action}" für Raum "${room.title}" (#${room.id}) fehlgeschlagen: ${message}`,
        );
        result.status = 'failed';
        result.error = message;
        return result;
      }
    }

    await this.roomRepo.update(room.id, { heated: heatedAfter });
    room.heated = heatedAfter;
    result.heatedAfter = heatedAfter;
    result.status = avmId ? 'sent' : 'skipped';

    await this.auditLogService.log({
      user: user ? { id: user.id } : null,
      action: heatedAfter ? AuditAction.HEATING_ON : AuditAction.HEATING_OFF,
      service: AuditService.HEATING,
      entityType: AuditEntityType.ROOM,
      entityId: room.id,
      summary: `${heatedAfter ? 'Aufheizen' : 'Absenken'} von Raum "${room.title}" auf ${targetTemperature} °C${avmId ? '' : ' (kein Thermostat hinterlegt, nur Zustand aktualisiert)'}: ${decision.reason}`,
    });

    return result;
  }
}
