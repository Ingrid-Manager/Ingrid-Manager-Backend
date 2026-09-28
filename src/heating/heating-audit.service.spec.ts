import {
  AuditLogParams,
  AuditLogService,
} from '../audit-log/audit-log.service';
import { AuditAction } from '../audit-log/audit-action.enum';
import { AuditService } from '../audit-log/audit-service.enum';
import { AuditEntityType } from '../audit-log/audit-entity-type.enum';
import {
  HeatingAuditLabels,
  HeatingAuditService,
} from './heating-audit.service';
import { HeatingAction, HeatingActionResult } from './domain/heating-action';
import { HeatingError, HeatingErrorCode } from './domain/heating-error';

const labels = (): HeatingAuditLabels => ({
  rooms: new Map([
    [1, 'Saal'],
    [2, 'Küche'],
  ]),
  locations: new Map([[10, 'Gemeindehaus']]),
  events: new Map([[7, 'Chorprobe']]),
});

const action = (overrides: Partial<HeatingAction> = {}): HeatingAction => ({
  roomId: 1,
  locationId: 10,
  action: 'HEAT',
  targetTemperature: 21,
  avmId: 'AIN-1',
  eventId: 7,
  reason: 'EVENT_PRELIM',
  ...overrides,
});

const unreachable = () =>
  new HeatingError(
    HeatingErrorCode.FRITZBOX_UNREACHABLE,
    'FRITZ!Box of location 10 is not reachable',
    { locationId: 10 },
    new Error('fetch failed'),
  );

const thermostatError = (roomId = 1) =>
  new HeatingError(
    HeatingErrorCode.THERMOSTAT_UNREACHABLE,
    'Thermostat AIN-1 is not reachable',
    { locationId: 10, roomId, avmId: 'AIN-1' },
  );

describe('HeatingAuditService', () => {
  let entries: AuditLogParams[];
  let service: HeatingAuditService;

  const record = (
    results: HeatingActionResult[],
    errors: HeatingError[] = [],
  ) => service.record({ results, errors, labels: labels() });

  beforeEach(() => {
    entries = [];
    const auditLogService = {
      log: jest.fn((params: AuditLogParams) => {
        entries.push(params);
        return Promise.resolve();
      }),
    };
    service = new HeatingAuditService(
      auditLogService as unknown as AuditLogService,
    );
  });

  it('should log a heated room', async () => {
    await record([{ action: action(), status: 'applied' }]);

    expect(entries).toEqual([
      {
        user: null,
        action: AuditAction.ROOM_HEATED,
        service: AuditService.HEATING,
        entityType: AuditEntityType.ROOM,
        entityId: 1,
        summary:
          'Raum "Saal" (Gemeindehaus) wurde aufgeheizt auf 21 °C (Termin steht an bzw. läuft: "Chorprobe")',
        changes: {
          heated: { old: false, new: true },
          targetTemperature: { old: null, new: 21 },
        },
      },
    ]);
  });

  it('should log a cooled room with its reason', async () => {
    await record([
      {
        action: action({
          action: 'COOL',
          targetTemperature: 16.5,
          eventId: null,
          reason: 'NO_ACTIVE_EVENT',
        }),
        status: 'applied',
      },
    ]);

    expect(entries[0].action).toBe(AuditAction.ROOM_COOLED);
    expect(entries[0].summary).toBe(
      'Raum "Saal" (Gemeindehaus) wurde abgesenkt auf 16,5 °C (kein aktiver oder anstehender Termin)',
    );
    expect(entries[0].changes.heated).toEqual({ old: true, new: false });
  });

  it('should mark state changes of rooms without thermostat', async () => {
    await record([{ action: action({ avmId: null }), status: 'skipped' }]);

    expect(entries[0].summary).toContain(
      'kein Thermostat hinterlegt, nur Status geändert',
    );
  });

  it('should fall back to ids for unknown labels', async () => {
    await record([
      {
        action: action({ roomId: 99, locationId: 77, eventId: 5 }),
        status: 'applied',
      },
    ]);

    expect(entries[0].summary).toBe(
      'Raum "#99" (Location #77) wurde aufgeheizt auf 21 °C (Termin steht an bzw. läuft: "#5")',
    );
  });

  it('should log an unreachable FRITZ!Box once with affected rooms', async () => {
    const error = unreachable();
    const failed: HeatingActionResult[] = [
      { action: action(), status: 'failed', error },
      {
        action: action({ roomId: 2, action: 'COOL', targetTemperature: 16 }),
        status: 'failed',
        error,
      },
    ];

    await record(failed, [error]);
    await record(failed, [unreachable()]);
    await record(failed, [unreachable()]);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      action: AuditAction.HEATING_ERROR,
      service: AuditService.HEATING,
      entityType: AuditEntityType.AVM_LOCATION,
      entityId: 10,
    });
    expect(entries[0].summary).toBe(
      'Heizbefehle fehlgeschlagen: FRITZ!Box der Location "Gemeindehaus" ist nicht erreichbar' +
        ' - betroffen: "Saal" (Aufheizen auf 21 °C), "Küche" (Absenken auf 16 °C)',
    );
    expect(entries[0].changes).toEqual({
      errorCode: { old: null, new: HeatingErrorCode.FRITZBOX_UNREACHABLE },
      detail: {
        old: null,
        new: 'FRITZ!Box of location 10 is not reachable (Error: fetch failed)',
      },
    });
  });

  it('should log the recovery of a FRITZ!Box', async () => {
    await record([], [unreachable()]);
    await record([{ action: action(), status: 'applied' }]);

    expect(entries.map((entry) => entry.action)).toEqual([
      AuditAction.HEATING_ERROR,
      AuditAction.ROOM_HEATED,
      AuditAction.HEATING_RECOVERED,
    ]);
    expect(entries[2]).toMatchObject({
      entityType: AuditEntityType.AVM_LOCATION,
      entityId: 10,
      summary:
        'FRITZ!Box der Location "Gemeindehaus" ist wieder erreichbar, Heizbefehle werden wieder ausgeführt',
    });
  });

  it('should not report a recovery for a room without thermostat', async () => {
    await record([], [unreachable()]);
    await record(
      [{ action: action({ avmId: null }), status: 'skipped' }],
      [unreachable()],
    );

    expect(entries.map((entry) => entry.action)).toEqual([
      AuditAction.HEATING_ERROR,
      AuditAction.ROOM_HEATED,
    ]);
  });

  it('should log thermostat errors per room and their recovery', async () => {
    await record([], [thermostatError(1), thermostatError(2)]);
    await record([], [thermostatError(1), thermostatError(2)]);
    await record(
      [{ action: action({ roomId: 1 }), status: 'applied' }],
      [thermostatError(2)],
    );

    expect(
      entries.map((entry) => [entry.action, entry.entityType, entry.entityId]),
    ).toEqual([
      [AuditAction.HEATING_ERROR, AuditEntityType.ROOM, 1],
      [AuditAction.HEATING_ERROR, AuditEntityType.ROOM, 2],
      [AuditAction.ROOM_HEATED, AuditEntityType.ROOM, 1],
      [AuditAction.HEATING_RECOVERED, AuditEntityType.ROOM, 1],
    ]);
    expect(entries[0].summary).toBe(
      'Heizbefehl für Raum "Saal" fehlgeschlagen: Thermostat AIN-1 ist nicht erreichbar oder unbekannt',
    );
  });

  it('should log an error again after it had disappeared', async () => {
    await record([], [unreachable()]);
    await record([]);
    await record([], [unreachable()]);

    expect(
      entries.filter((entry) => entry.action === AuditAction.HEATING_ERROR),
    ).toHaveLength(2);
  });

  it('should log global errors once per message', async () => {
    const config = () =>
      new HeatingError(
        HeatingErrorCode.CONFIGURATION_ERROR,
        'HEATING_SEASON_START/HEATING_SEASON_END are missing or invalid',
      );
    const unknownRoom = (eventId: number) =>
      new HeatingError(
        HeatingErrorCode.UNKNOWN_ROOM,
        `Calendar event ${eventId} references an unknown room`,
      );

    await record([], [config(), unknownRoom(1)]);
    await record([], [config(), unknownRoom(1), unknownRoom(2)]);

    expect(entries.map((entry) => entry.summary)).toEqual([
      'Heizungssteuerung: Konfigurationsfehler (HEATING_SEASON_START/HEATING_SEASON_END are missing or invalid)',
      'Heizungssteuerung: unbekannter Raum (Calendar event 1 references an unknown room)',
      'Heizungssteuerung: unbekannter Raum (Calendar event 2 references an unknown room)',
    ]);
    expect(entries[0]).toMatchObject({
      entityType: AuditEntityType.SYSTEM,
      entityId: null,
    });
  });

  it('should truncate long technical details', async () => {
    await record(
      [],
      [
        new HeatingError(
          HeatingErrorCode.DATA_SOURCE_ERROR,
          'Calendar events could not be loaded',
          {},
          new Error('x'.repeat(1000)),
        ),
      ],
    );

    expect(String(entries[0].changes.detail.new).length).toBe(300);
  });
});
