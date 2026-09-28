import { ConfigService } from '@nestjs/config';

import { AllConfigType } from '../config/config.type';
import { RoomsService } from '../rooms/rooms.service';
import { CalendarEventsService } from '../calendar-events/calendar-events.service';
import { HeatingService } from './heating.service';
import { FritzBoxConnectionManager } from './fritzbox-connection-manager.service';
import { HeatingConfig } from './config/heating-config.type';
import { HeatingError, HeatingErrorCode } from './domain/heating-error';
import { HeatingClock, HeatingScheduler } from './heating-scheduler.service';
import { HeatingAuditService } from './heating-audit.service';
import {
  AuditLogParams,
  AuditLogService,
} from '../audit-log/audit-log.service';
import { AuditAction } from '../audit-log/audit-action.enum';
import { AuditService } from '../audit-log/audit-service.enum';

/*
 * Integrationstest der Heizungssteuerung: echter Scheduler, echte
 * Heizregeln und echter HeatingService. Ersetzt werden nur Datenbank
 * (In-Memory-Räume/-Termine) und die FRITZ!Box-Verbindungen je Location.
 */

const MINUTE = 60_000;
const NOW = new Date(2026, 0, 15, 20, 0, 0); // in der Heizsaison
const SUMMER = new Date(2026, 6, 15, 20, 0, 0); // außerhalb der Heizsaison

type RoomRow = {
  id: number;
  title: string;
  locationid: number;
  prelim_time: number;
  comfort_temp: number;
  empty_temp: number;
  heated: boolean;
  avm_id: string | null;
  location?: { title: string };
};

type EventRow = {
  id: number;
  roomid: number;
  start: Date;
  end: Date;
};

type Command = { locationId: number; ain: string; temperature: number };

class FakeFritzBox {
  constructor(
    private readonly locationId: number,
    private readonly commands: Command[],
    private readonly ains: string[],
  ) {}

  listDevices() {
    return Promise.resolve(this.ains.map((ain) => ({ ain, present: true })));
  }

  isGroup() {
    return Promise.resolve(false);
  }

  thermostats = {
    get: (ain: string) => ({
      setTemperature: (temperature: number) => {
        this.commands.push({ locationId: this.locationId, ain, temperature });
        return Promise.resolve();
      },
    }),
  };
}

const LOCATION_TITLES: Record<number, string> = {
  1: 'Gemeindehaus A',
  2: 'Gemeindehaus B',
};

const roomRow = (overrides: Partial<RoomRow>): RoomRow => {
  const row: RoomRow = {
    id: 1,
    title: 'Raum',
    locationid: 1,
    prelim_time: 60,
    comfort_temp: 21,
    empty_temp: 16,
    heated: false,
    avm_id: null,
    ...overrides,
  };

  if (!row.location && LOCATION_TITLES[row.locationid]) {
    row.location = { title: LOCATION_TITLES[row.locationid] };
  }

  return row;
};

const eventAt = (
  id: number,
  roomid: number,
  startOffset: number,
  duration: number,
  now = NOW,
): EventRow => ({
  id,
  roomid,
  start: new Date(now.getTime() + startOffset * MINUTE),
  end: new Date(now.getTime() + (startOffset + duration) * MINUTE),
});

describe('HeatingScheduler', () => {
  let rooms: RoomRow[];
  let events: EventRow[];
  let commands: Command[];
  let boxes: Map<number, FakeFritzBox>;
  let unreachable: Set<number>;
  let config: HeatingConfig;
  let clockNow: Date;
  let roomsService: {
    findAllForHeating: jest.Mock;
    setHeated: jest.Mock;
  };
  let calendarEventsService: { findActiveHeatingEvents: jest.Mock };
  let connections: { getConnection: jest.Mock; invalidate: jest.Mock };
  let scheduler: HeatingScheduler;
  let auditEntries: AuditLogParams[];

  const heatedOf = (id: number) => rooms.find((room) => room.id === id).heated;

  beforeEach(() => {
    commands = [];
    unreachable = new Set();
    clockNow = NOW;
    config = {
      seasonStart: '10-01',
      seasonEnd: '04-30',
      hallwayRoomIds: [],
      schedulerEnabled: true,
    };

    // Location 1 (FRITZ!Box A): Wohnzimmer, Küche, Flur
    // Location 2 (FRITZ!Box B): Schlafzimmer, Bad
    rooms = [
      roomRow({ id: 1, title: 'Wohnzimmer', locationid: 1, avm_id: 'A-1' }),
      roomRow({ id: 2, title: 'Küche', locationid: 1, avm_id: 'A-2' }),
      roomRow({
        id: 3,
        title: 'Flur A',
        locationid: 1,
        avm_id: 'A-3',
        comfort_temp: 19,
        empty_temp: 15,
      }),
      roomRow({ id: 4, title: 'Schlafzimmer', locationid: 2, avm_id: 'B-1' }),
      roomRow({ id: 5, title: 'Bad', locationid: 2, avm_id: 'B-2' }),
    ];
    events = [];

    boxes = new Map([
      [1, new FakeFritzBox(1, commands, ['A-1', 'A-2', 'A-3'])],
      [2, new FakeFritzBox(2, commands, ['B-1', 'B-2'])],
    ]);

    roomsService = {
      findAllForHeating: jest.fn(() =>
        Promise.resolve(rooms.map((room) => ({ ...room }))),
      ),
      setHeated: jest.fn((id: number, heated: boolean) => {
        rooms.find((room) => room.id === id).heated = heated;
        return Promise.resolve();
      }),
    };

    calendarEventsService = {
      findActiveHeatingEvents: jest.fn((from: Date, to: Date) =>
        Promise.resolve(
          events.filter((event) => event.end >= from && event.start <= to),
        ),
      ),
    };

    connections = {
      getConnection: jest.fn((locationId: number) => {
        if (unreachable.has(locationId)) {
          return Promise.reject(
            new HeatingError(
              HeatingErrorCode.FRITZBOX_UNREACHABLE,
              `FRITZ!Box of location ${locationId} is not reachable`,
              { locationId },
            ),
          );
        }
        const box = boxes.get(locationId);
        if (!box) {
          return Promise.reject(
            new HeatingError(
              HeatingErrorCode.UNKNOWN_LOCATION,
              `Location ${locationId} does not exist`,
              { locationId },
            ),
          );
        }
        return Promise.resolve(box);
      }),
      invalidate: jest.fn(() => Promise.resolve()),
    };

    const configService = {
      get: jest.fn((key: string) => (key === 'heating' ? config : undefined)),
    };
    const clock: HeatingClock = { now: () => clockNow };

    auditEntries = [];
    const auditLogService = {
      log: jest.fn((params: AuditLogParams) => {
        auditEntries.push(params);
        return Promise.resolve();
      }),
    };

    const heatingService = new HeatingService(
      connections as unknown as FritzBoxConnectionManager,
    );

    scheduler = new HeatingScheduler(
      configService as unknown as ConfigService<AllConfigType>,
      roomsService as unknown as RoomsService,
      calendarEventsService as unknown as CalendarEventsService,
      heatingService,
      clock,
      new HeatingAuditService(auditLogService as unknown as AuditLogService),
    );
  });

  const heatingAudit = () =>
    auditEntries.filter((entry) => entry.service === AuditService.HEATING);

  describe('season check', () => {
    it('should run the heating calculation within the season', async () => {
      events = [eventAt(1, 1, 30, 60)];

      const result = await scheduler.run(NOW);

      expect(result.inSeason).toBe(true);
      expect(calendarEventsService.findActiveHeatingEvents).toHaveBeenCalled();
      expect(commands).toEqual([
        { locationId: 1, ain: 'A-1', temperature: 21 },
      ]);
      expect(heatedOf(1)).toBe(true);
    });

    it('should send no heating commands outside the season', async () => {
      events = [eventAt(1, 1, 30, 60, SUMMER)];

      const result = await scheduler.run(SUMMER);

      expect(result.inSeason).toBe(false);
      expect(
        calendarEventsService.findActiveHeatingEvents,
      ).not.toHaveBeenCalled();
      expect(commands).toEqual([]);
      expect(heatedOf(1)).toBe(false);
    });

    it('should cool heated rooms exactly once when leaving the season', async () => {
      rooms[0].heated = true; // Wohnzimmer, Location 1
      rooms[3].heated = true; // Schlafzimmer, Location 2

      const first = await scheduler.run(SUMMER);

      expect(first.actions.map((a) => [a.roomId, a.action, a.reason])).toEqual([
        [1, 'COOL', 'SEASON_END'],
        [4, 'COOL', 'SEASON_END'],
      ]);
      expect(commands).toEqual([
        { locationId: 1, ain: 'A-1', temperature: 16 },
        { locationId: 2, ain: 'B-1', temperature: 16 },
      ]);
      expect(heatedOf(1)).toBe(false);
      expect(heatedOf(4)).toBe(false);

      const second = await scheduler.run(new Date(SUMMER.getTime() + MINUTE));

      expect(second.actions).toEqual([]);
      expect(commands).toHaveLength(2);
    });

    it('should retry the season exit cooling when the FRITZ!Box was unreachable', async () => {
      rooms[3].heated = true;
      unreachable.add(2);

      await scheduler.run(SUMMER);
      expect(heatedOf(4)).toBe(true);

      unreachable.clear();
      await scheduler.run(new Date(SUMMER.getTime() + MINUTE));

      expect(heatedOf(4)).toBe(false);
      expect(commands).toEqual([
        { locationId: 2, ain: 'B-1', temperature: 16 },
      ]);
    });

    it('should not send commands when the season is not configured', async () => {
      config = { ...config, seasonStart: undefined };
      events = [eventAt(1, 1, 30, 60)];

      const result = await scheduler.run(NOW);

      expect(result.inSeason).toBeNull();
      expect(result.errors[0].code).toBe(HeatingErrorCode.CONFIGURATION_ERROR);
      expect(commands).toEqual([]);
    });
  });

  describe('idempotency', () => {
    it('should not repeat HEAT or COOL commands on identical state', async () => {
      // 19:00 - 20:00 (Vorlauf 60 Minuten)
      const start = new Date(2026, 0, 15, 19, 0, 0);
      events = [
        {
          id: 1,
          roomid: 1,
          start,
          end: new Date(start.getTime() + 60 * MINUTE),
        },
      ];

      // 18:00 -> HEAT (Vorlauf beginnt), 18:01 -> nichts
      await scheduler.run(new Date(2026, 0, 15, 18, 0, 30));
      await scheduler.run(new Date(2026, 0, 15, 18, 1, 30));
      await scheduler.run(new Date(2026, 0, 15, 19, 30, 0));

      expect(commands).toEqual([
        { locationId: 1, ain: 'A-1', temperature: 21 },
      ]);
      expect(heatedOf(1)).toBe(true);

      // 20:01 -> COOL, 20:02 -> nichts
      await scheduler.run(new Date(2026, 0, 15, 20, 1, 0));
      await scheduler.run(new Date(2026, 0, 15, 20, 2, 0));
      await scheduler.run(new Date(2026, 0, 15, 20, 3, 0));

      expect(commands).toEqual([
        { locationId: 1, ain: 'A-1', temperature: 21 },
        { locationId: 1, ain: 'A-1', temperature: 16 },
      ]);
      expect(heatedOf(1)).toBe(false);
    });

    it('should produce no commands on repeated runs without changes', async () => {
      rooms[0].heated = true;
      events = [eventAt(1, 1, -10, 60)];

      for (let minute = 0; minute < 5; minute++) {
        const result = await scheduler.run(
          new Date(NOW.getTime() + minute * MINUTE),
        );
        expect(result.actions).toEqual([]);
      }

      expect(commands).toEqual([]);
      expect(roomsService.setHeated).not.toHaveBeenCalled();
    });
  });

  describe('multiple locations', () => {
    it('should use the FRITZ!Box of each location', async () => {
      events = [eventAt(1, 1, 30, 60), eventAt(2, 4, 30, 60)];

      await scheduler.run(NOW);

      expect(commands).toEqual(
        expect.arrayContaining([
          { locationId: 1, ain: 'A-1', temperature: 21 },
          { locationId: 2, ain: 'B-1', temperature: 21 },
        ]),
      );
      expect(commands).toHaveLength(2);
      expect(connections.getConnection).toHaveBeenCalledWith(1);
      expect(connections.getConnection).toHaveBeenCalledWith(2);
    });

    it('should never send actions of one location to another FRITZ!Box', async () => {
      events = [eventAt(1, 4, 30, 60)];

      await scheduler.run(NOW);

      expect(commands).toEqual([
        { locationId: 2, ain: 'B-1', temperature: 21 },
      ]);
      expect(connections.getConnection).not.toHaveBeenCalledWith(1);
    });

    it('should keep processing other locations when one FRITZ!Box fails', async () => {
      unreachable.add(1);
      events = [eventAt(1, 1, 30, 60), eventAt(2, 4, 30, 60)];

      const result = await scheduler.run(NOW);

      expect(commands).toEqual([
        { locationId: 2, ain: 'B-1', temperature: 21 },
      ]);
      expect(heatedOf(1)).toBe(false); // wird im nächsten Lauf erneut versucht
      expect(heatedOf(4)).toBe(true);
      expect(result.errors.map((e) => e.code)).toEqual([
        HeatingErrorCode.FRITZBOX_UNREACHABLE,
      ]);

      unreachable.clear();
      await scheduler.run(new Date(NOW.getTime() + MINUTE));

      expect(heatedOf(1)).toBe(true);
      expect(commands).toEqual([
        { locationId: 2, ain: 'B-1', temperature: 21 },
        { locationId: 1, ain: 'A-1', temperature: 21 },
      ]);
    });

    it('should report rooms of an unknown location', async () => {
      rooms.push(roomRow({ id: 9, locationid: 99, avm_id: 'X-1' }));
      events = [eventAt(1, 9, 30, 60), eventAt(2, 4, 30, 60)];

      const result = await scheduler.run(NOW);

      expect(result.errors.map((e) => e.code)).toEqual([
        HeatingErrorCode.UNKNOWN_LOCATION,
      ]);
      expect(heatedOf(9)).toBe(false);
      expect(heatedOf(4)).toBe(true);
    });

    it('should report events of unknown rooms', async () => {
      events = [eventAt(1, 404, 30, 60)];

      const result = await scheduler.run(NOW);

      expect(result.errors.map((e) => e.code)).toEqual([
        HeatingErrorCode.UNKNOWN_ROOM,
      ]);
      expect(commands).toEqual([]);
    });
  });

  describe('hallway', () => {
    beforeEach(() => {
      config = { ...config, hallwayRoomIds: [3] };
    });

    it('should heat the hallway together with the first heated room', async () => {
      events = [eventAt(1, 1, 30, 60)];

      await scheduler.run(NOW);

      expect(commands).toEqual([
        { locationId: 1, ain: 'A-1', temperature: 21 },
        { locationId: 1, ain: 'A-3', temperature: 19 },
      ]);
      expect(heatedOf(3)).toBe(true);
    });

    it('should not heat the hallway of another location', async () => {
      events = [eventAt(1, 4, 30, 60)];

      await scheduler.run(NOW);

      expect(heatedOf(3)).toBe(false);
      expect(commands).toEqual([
        { locationId: 2, ain: 'B-1', temperature: 21 },
      ]);
    });

    it('should cool the hallway after the last room was cooled', async () => {
      rooms[0].heated = true;
      rooms[2].heated = true;
      events = [eventAt(1, 1, -62, 60)];

      await scheduler.run(NOW);

      expect(commands).toEqual([
        { locationId: 1, ain: 'A-1', temperature: 16 },
        { locationId: 1, ain: 'A-3', temperature: 15 },
      ]);
      expect(heatedOf(3)).toBe(false);
    });

    it('should keep the hallway heated while an event starts anywhere in the house', async () => {
      rooms[2].heated = true;
      events = [eventAt(1, 2, 60, 60)]; // Küche, Vorlauf 60 -> noch nicht

      rooms[1].prelim_time = 30;
      await scheduler.run(NOW);

      expect(commands).toEqual([]);
      expect(heatedOf(3)).toBe(true);
    });

    it('should report an ambiguous hallway configuration', async () => {
      config = { ...config, hallwayRoomIds: [3, 2] };
      events = [eventAt(1, 1, 30, 60)];

      const result = await scheduler.run(NOW);

      expect(result.errors.map((e) => e.code)).toEqual([
        HeatingErrorCode.CONFIGURATION_ERROR,
      ]);
      // Flur-Regel deaktiviert, normale Raumregel läuft weiter
      expect(commands).toEqual([
        { locationId: 1, ain: 'A-1', temperature: 21 },
      ]);
    });
  });

  describe('missed cool window', () => {
    it('should cool after a FRITZ!Box outage longer than the cool window', async () => {
      rooms[0].heated = true;
      events = [eventAt(1, 1, -61, 60)]; // endete vor 1 Minute
      unreachable.add(1);

      for (let minute = 0; minute < 10; minute++) {
        await scheduler.run(new Date(NOW.getTime() + minute * MINUTE));
      }
      expect(heatedOf(1)).toBe(true);
      expect(commands).toEqual([]);

      unreachable.clear();
      await scheduler.run(new Date(NOW.getTime() + 10 * MINUTE));
      await scheduler.run(new Date(NOW.getTime() + 11 * MINUTE));

      expect(heatedOf(1)).toBe(false);
      expect(commands).toEqual([
        { locationId: 1, ain: 'A-1', temperature: 16 },
      ]);
    });

    it('should cool when the bridging follow-up event is deleted later', async () => {
      rooms[0].heated = true;
      events = [eventAt(1, 1, -61, 60), eventAt(2, 1, 60, 60)];

      for (let minute = 0; minute < 10; minute++) {
        await scheduler.run(new Date(NOW.getTime() + minute * MINUTE));
      }
      expect(heatedOf(1)).toBe(true);

      events = [events[0]]; // Folgetermin gelöscht
      await scheduler.run(new Date(NOW.getTime() + 10 * MINUTE));

      expect(heatedOf(1)).toBe(false);
      expect(commands).toEqual([
        { locationId: 1, ain: 'A-1', temperature: 16 },
      ]);
    });

    it('should cool rooms after a backend restart', async () => {
      // Zustand aus der DB: beheizt, Termin seit einer Stunde beendet
      rooms[0].heated = true;
      events = [eventAt(1, 1, -120, 60)];

      await scheduler.run(NOW);

      expect(heatedOf(1)).toBe(false);
      expect(commands).toEqual([
        { locationId: 1, ain: 'A-1', temperature: 16 },
      ]);
    });

    it('should release the hallway once the stuck room was cooled', async () => {
      config = { ...config, hallwayRoomIds: [3] };
      rooms[0].heated = true;
      rooms[2].heated = true;
      events = [eventAt(1, 1, -120, 60)];

      await scheduler.run(NOW);

      expect(commands).toEqual([
        { locationId: 1, ain: 'A-1', temperature: 16 },
        { locationId: 1, ain: 'A-3', temperature: 15 },
      ]);
      expect(heatedOf(1)).toBe(false);
      expect(heatedOf(3)).toBe(false);
    });
  });

  describe('audit log', () => {
    it('should log "Raum wurde aufgeheizt" and "Raum wurde abgesenkt"', async () => {
      events = [eventAt(1, 1, 30, 60)];
      await scheduler.run(NOW);

      events = [eventAt(1, 1, -62, 60)];
      await scheduler.run(new Date(NOW.getTime() + MINUTE));

      expect(heatingAudit().map((entry) => entry.action)).toEqual([
        AuditAction.ROOM_HEATED,
        AuditAction.ROOM_COOLED,
      ]);
      expect(heatingAudit()[0]).toMatchObject({
        user: null,
        entityType: 'room',
        entityId: 1,
      });
      expect(heatingAudit()[0].summary).toContain(
        'Raum "Wohnzimmer" (Gemeindehaus A) wurde aufgeheizt auf 21 °C',
      );
      expect(heatingAudit()[1].summary).toContain(
        'Raum "Wohnzimmer" (Gemeindehaus A) wurde abgesenkt auf 16 °C',
      );
    });

    it('should not log anything when nothing changes', async () => {
      rooms[0].heated = true;
      events = [eventAt(1, 1, -10, 60)];

      await scheduler.run(NOW);
      await scheduler.run(new Date(NOW.getTime() + MINUTE));

      expect(heatingAudit()).toEqual([]);
    });

    it('should log an unreachable FRITZ!Box once and its recovery', async () => {
      unreachable.add(1);
      events = [eventAt(1, 1, 30, 60), eventAt(2, 4, 30, 60)];

      for (let minute = 0; minute < 5; minute++) {
        await scheduler.run(new Date(NOW.getTime() + minute * MINUTE));
      }

      const errors = heatingAudit().filter(
        (entry) => entry.action === AuditAction.HEATING_ERROR,
      );
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({
        entityType: 'avm-location',
        entityId: 1,
      });
      expect(errors[0].summary).toContain(
        'FRITZ!Box der Location "Gemeindehaus A" ist nicht erreichbar',
      );
      expect(errors[0].summary).toContain('"Wohnzimmer" (Aufheizen auf 21 °C)');
      expect(errors[0].changes.errorCode.new).toBe(
        HeatingErrorCode.FRITZBOX_UNREACHABLE,
      );
      // Location B wurde trotzdem aufgeheizt
      expect(
        heatingAudit().filter(
          (entry) => entry.action === AuditAction.ROOM_HEATED,
        ),
      ).toHaveLength(1);

      unreachable.clear();
      await scheduler.run(new Date(NOW.getTime() + 5 * MINUTE));

      expect(
        heatingAudit()
          .slice(-2)
          .map((entry) => entry.action),
      ).toEqual([AuditAction.ROOM_HEATED, AuditAction.HEATING_RECOVERED]);
      expect(heatingAudit().slice(-1)[0].summary).toContain(
        'FRITZ!Box der Location "Gemeindehaus A" ist wieder erreichbar',
      );
    });

    it('should log a failed thermostat command for the room', async () => {
      rooms[0].avm_id = 'A-404';
      events = [eventAt(1, 1, 30, 60)];

      await scheduler.run(NOW);
      await scheduler.run(new Date(NOW.getTime() + MINUTE));

      const errors = heatingAudit().filter(
        (entry) => entry.action === AuditAction.HEATING_ERROR,
      );
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({ entityType: 'room', entityId: 1 });
      expect(errors[0].summary).toContain(
        'Heizbefehl für Raum "Wohnzimmer" fehlgeschlagen: Thermostat A-404',
      );
    });

    it('should log configuration errors only once', async () => {
      config = { ...config, seasonEnd: 'kaputt' };

      await scheduler.run(NOW);
      await scheduler.run(new Date(NOW.getTime() + MINUTE));

      const errors = heatingAudit().filter(
        (entry) => entry.action === AuditAction.HEATING_ERROR,
      );
      expect(errors).toHaveLength(1);
      expect(errors[0].summary).toContain('Konfigurationsfehler');
    });

    it('should log database errors', async () => {
      calendarEventsService.findActiveHeatingEvents.mockRejectedValueOnce(
        new Error('db down'),
      );

      await scheduler.run(NOW);

      expect(heatingAudit()).toEqual([
        expect.objectContaining({
          action: AuditAction.HEATING_ERROR,
          summary: expect.stringContaining(
            'Kalender/Datenbank konnte nicht gelesen werden',
          ),
        }),
      ]);
    });
  });

  describe('error handling', () => {
    it('should report database errors without throwing', async () => {
      calendarEventsService.findActiveHeatingEvents.mockRejectedValueOnce(
        new Error('db down'),
      );

      const result = await scheduler.run(NOW);

      expect(result.errors.map((e) => e.code)).toEqual([
        HeatingErrorCode.DATA_SOURCE_ERROR,
      ]);
      expect(commands).toEqual([]);
    });

    it('should report invalid room temperatures', async () => {
      rooms[0].comfort_temp = 40;
      events = [eventAt(1, 1, 30, 60), eventAt(2, 2, 30, 60)];

      const result = await scheduler.run(NOW);

      expect(result.errors.map((e) => e.code)).toEqual([
        HeatingErrorCode.INVALID_TEMPERATURE,
      ]);
      expect(heatedOf(1)).toBe(false);
      expect(heatedOf(2)).toBe(true);
    });
  });

  describe('scheduling', () => {
    it('should run on the cron tick without waiting a minute', async () => {
      events = [eventAt(1, 1, 30, 60)];

      await scheduler.handleCron();

      expect(commands).toHaveLength(1);
    });

    it('should not run when the scheduler is disabled', async () => {
      config = { ...config, schedulerEnabled: false };
      events = [eventAt(1, 1, 30, 60)];

      await scheduler.handleCron();

      expect(roomsService.findAllForHeating).not.toHaveBeenCalled();
    });

    it('should never run two heating runs at the same time', async () => {
      let release: () => void;
      const blocked = new Promise<void>((resolve) => {
        release = resolve;
      });
      let active = 0;
      let maxActive = 0;

      roomsService.findAllForHeating.mockImplementation(async () => {
        active++;
        maxActive = Math.max(maxActive, active);
        if (roomsService.findAllForHeating.mock.calls.length === 1) {
          await blocked;
        }
        active--;
        return rooms.map((room) => ({ ...room }));
      });

      const first = scheduler.trigger(); // 20:00
      const second = scheduler.trigger(); // 20:01 während 20:00 noch läuft
      const third = scheduler.trigger();

      expect(scheduler.isRunning()).toBe(true);
      expect(roomsService.findAllForHeating).toHaveBeenCalledTimes(1);

      release();
      await Promise.all([first, second, third]);

      // genau ein nachgeholter Lauf, nie parallel
      expect(roomsService.findAllForHeating).toHaveBeenCalledTimes(2);
      expect(maxActive).toBe(1);
      expect(scheduler.isRunning()).toBe(false);
    });
  });

  describe('graceful shutdown', () => {
    it('should wait for a running heating run and not start new runs', async () => {
      let release: () => void;
      const blocked = new Promise<void>((resolve) => {
        release = resolve;
      });

      roomsService.findAllForHeating.mockImplementationOnce(async () => {
        await blocked;
        return rooms.map((room) => ({ ...room }));
      });

      const run = scheduler.trigger();
      scheduler.trigger(); // nachgeholter Lauf wird beim Shutdown verworfen

      let destroyed = false;
      const destroy = scheduler.onModuleDestroy().then(() => {
        destroyed = true;
      });

      await Promise.resolve();
      expect(destroyed).toBe(false);

      release();
      await run;
      await destroy;

      expect(destroyed).toBe(true);
      expect(roomsService.findAllForHeating).toHaveBeenCalledTimes(1);

      await scheduler.handleCron();
      expect(roomsService.findAllForHeating).toHaveBeenCalledTimes(1);
    });
  });
});
