import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

import { HeatingService } from './heating.service';
import { Room } from '../rooms/infrastructure/relational/persistence/entities/room.entity';
import { CalendarEvent } from '../calendar-events/infrastructure/relational/persistence/entities/calendar-event.entity';
import { HEATING_COMMAND_DISPATCHER } from './dispatcher/heating-command-dispatcher';
import { AuditLogService } from '../audit-log/audit-log.service';
import { HeatingConfig } from './config/heating-config.type';
import { HeatingAction } from './domain/heating-rules';

const NOW = new Date('2026-01-15T12:00:00');
const at = (min: number) => new Date(NOW.getTime() + min * 60_000);

function makeRoom(overrides: Partial<Room>): Room {
  return {
    id: 1,
    title: 'Saal',
    avm_id: 'ain-1',
    comfort_temp: 21,
    empty_temp: 16,
    prelim_time: 60,
    heated: false,
    color: '#fff',
    hidden: false,
    locationid: 1,
    createdbyid: 1,
    ...overrides,
  } as Room;
}

describe('HeatingService', () => {
  let service: HeatingService;
  let rooms: Room[];
  let events: Partial<CalendarEvent>[];
  let config: HeatingConfig;
  const dispatcher = { dispatch: jest.fn() };
  const roomRepo = {
    find: jest.fn(() => Promise.resolve(rooms)),
    update: jest.fn(() => Promise.resolve()),
  };
  const qb: Record<string, jest.Mock> = {};
  for (const m of ['where', 'andWhere', 'orderBy']) {
    qb[m] = jest.fn(() => qb);
  }
  qb.getMany = jest.fn(() => Promise.resolve(events));

  beforeEach(async () => {
    jest.clearAllMocks();
    dispatcher.dispatch.mockResolvedValue(undefined);
    config = {
      enabled: true,
      seasonStart: '10-01',
      seasonEnd: '04-30',
      hallwayRoomId: 99,
    };
    rooms = [
      makeRoom({ id: 1 }),
      makeRoom({ id: 2, title: 'Küche', avm_id: null }),
      makeRoom({ id: 99, title: 'Flur', avm_id: 'grp-flur' }),
    ];
    events = [
      { id: 10, title: 'Chor', roomid: 1, start: at(30), end: at(120) },
    ];

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HeatingService,
        { provide: getRepositoryToken(Room), useValue: roomRepo },
        {
          provide: getRepositoryToken(CalendarEvent),
          useValue: { createQueryBuilder: jest.fn(() => qb) },
        },
        { provide: HEATING_COMMAND_DISPATCHER, useValue: dispatcher },
        {
          provide: ConfigService,
          useValue: { getOrThrow: jest.fn(() => config) },
        },
        {
          provide: AuditLogService,
          useValue: { log: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    service = module.get(HeatingService);
  });

  it('heizt Raum und Flur auf und speichert den Zustand', async () => {
    const result = await service.run(NOW);

    expect(dispatcher.dispatch).toHaveBeenCalledTimes(2);
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId: 1,
        avmId: 'ain-1',
        action: HeatingAction.HEAT,
        targetTemperature: 21,
        eventId: 10,
      }),
    );
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ roomId: 99, action: HeatingAction.HEAT }),
    );
    expect(roomRepo.update).toHaveBeenCalledWith(1, { heated: true });
    expect(roomRepo.update).toHaveBeenCalledWith(99, { heated: true });
    expect(result.rooms.find((r) => r.roomId === 99)?.isHallway).toBe(true);
  });

  it('ändert im dryRun weder Zustand noch Thermostate', async () => {
    const result = await service.run(NOW, { dryRun: true });

    expect(dispatcher.dispatch).not.toHaveBeenCalled();
    expect(roomRepo.update).not.toHaveBeenCalled();
    expect(result.rooms.filter((r) => r.status === 'planned')).toHaveLength(2);
  });

  it('behält den Zustand bei, wenn der Befehl fehlschlägt', async () => {
    dispatcher.dispatch.mockRejectedValue(new Error('Fritzbox offline'));

    const result = await service.run(NOW);

    expect(roomRepo.update).not.toHaveBeenCalled();
    const saal = result.rooms.find((r) => r.roomId === 1);
    expect(saal?.status).toBe('failed');
    expect(saal?.heatedAfter).toBe(false);
  });

  it('senkt außerhalb der Saison nur einmalig beheizte Räume ab', async () => {
    rooms[0].heated = true;
    const summer = new Date('2026-07-01T12:00:00');

    const result = await service.run(summer);

    expect(result.inSeason).toBe(false);
    expect(qb.getMany).not.toHaveBeenCalled();
    expect(dispatcher.dispatch).toHaveBeenCalledTimes(1);
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId: 1,
        action: HeatingAction.COOL,
        targetTemperature: 16,
      }),
    );
  });

  it('aktualisiert Räume ohne avm_id nur im Zustand', async () => {
    events = [
      { id: 11, title: 'Kochen', roomid: 2, start: at(-10), end: at(50) },
    ];

    const result = await service.run(NOW);

    expect(roomRepo.update).toHaveBeenCalledWith(2, { heated: true });
    expect(result.rooms.find((r) => r.roomId === 2)?.status).toBe('skipped');
    expect(dispatcher.dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ roomId: 2 }),
    );
  });

  it('läuft per Cron nur, wenn HEATING_ENABLED gesetzt ist', async () => {
    config.enabled = false;
    await service.runScheduled();
    expect(roomRepo.find).not.toHaveBeenCalled();
  });
});
