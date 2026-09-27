import { pbkdf2Sync } from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

import {
  AuthenticationError,
  ConnectionError,
  FritzBox,
  FritzBoxConfig,
  HttpResponse,
  HttpTransport,
  InvalidTemperatureError,
  ProtocolError,
  RequestOptions,
  SessionError,
  calculatePbkdf2Response,
} from '../../libs/fritzbox-aha/index.js';
import { AvmLocation } from '../../avm-locations/infrastructure/relational/persistence/entities/avm-location.entity';
import { CryptoService } from '../../crypto/crypto.service';
import { Room } from '../../rooms/infrastructure/relational/persistence/entities/room.entity';
import { CalendarEvent } from '../../calendar-events/infrastructure/relational/persistence/entities/calendar-event.entity';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { HeatingAction } from '../domain/heating-rules';
import {
  HEATING_COMMAND_DISPATCHER,
  HeatingCommand,
} from '../dispatcher/heating-command-dispatcher';
import { HeatingRulesService } from '../heating-rules.service';
import { HeatingConfig } from '../config/heating-config.type';
import {
  AUTH_FAILURE_COOLDOWN_MS,
  CONNECT_FAILURE_COOLDOWN_MS,
  FRITZBOX_FACTORY,
  FritzboxConnectionService,
} from './fritzbox-connection.service';
import {
  FritzboxDispatchError,
  FritzboxHeatingCommandDispatcher,
  toFritzboxTemperature,
} from './fritzbox-heating-command-dispatcher';

/*
 * Prüft die Strecke Backend -> FRITZ!Box mit der echten AHA-Bibliothek
 * aus src/libs/fritzbox-aha. Nur der HTTP-Transport ist simuliert
 * (`new FritzBox(config, transport)`).
 */

const USER = 'heizung';
const PASSWORD = 'Gemeinde-Haus!2026';
const THERMOSTAT_AIN = '09995 0179707';
const GROUP_AIN = 'grp303E4F-3F7A21659';

interface RecordedRequest {
  method: 'GET' | 'POST';
  url: URL;
  rawUrl: string;
  body?: string;
  headers?: Readonly<Record<string, string>>;
}

type Interceptor = (
  request: RecordedRequest,
) => HttpResponse | Error | undefined;

function response(status: number, body = ''): HttpResponse {
  return { status, headers: new Headers(), body };
}

function sessionInfo(sid: string, challenge: string, blockTime: number) {
  return `<?xml version="1.0" encoding="utf-8"?><SessionInfo><SID>${sid}</SID><Challenge>${challenge}</Challenge><BlockTime>${blockTime}</BlockTime><Rights></Rights><Users><User last="1">${USER}</User></Users></SessionInfo>`;
}

/** Eigene Referenz-Implementierung nach AVM "Session-IDs im FRITZ!Box Webinterface". */
function expectedPbkdf2Response(challenge: string, password: string) {
  const [, iter1, salt1, iter2, salt2] = challenge.split('$');
  const hash1 = pbkdf2Sync(
    Buffer.from(password, 'utf8'),
    Buffer.from(salt1, 'hex'),
    Number(iter1),
    32,
    'sha256',
  );
  const hash2 = pbkdf2Sync(
    hash1,
    Buffer.from(salt2, 'hex'),
    Number(iter2),
    32,
    'sha256',
  );
  return `${salt2}$${hash2.toString('hex')}`;
}

/** Simuliert Login (login_sid.lua, PBKDF2) und AHA-Interface einer FRITZ!Box. */
class SimulatedFritzBox implements HttpTransport {
  password = PASSWORD;
  blockTime = 0;
  // Wenige Iterationen, damit der Test schnell bleibt.
  readonly challenge = '2$50$1a2b3c4d$25$5e6f7a8b';
  readonly knownAins = new Set([THERMOSTAT_AIN, GROUP_AIN]);
  readonly requests: RecordedRequest[] = [];
  readonly setCommands: { ain: string; param: string }[] = [];
  interceptors: Interceptor[] = [];
  logins = 0;
  failedLogins = 0;
  logouts = 0;
  private readonly sessions = new Set<string>();
  private sidCounter = 0;

  get(url: string, options?: RequestOptions): Promise<HttpResponse> {
    return Promise.resolve().then(() => this.handle('GET', url, options));
  }

  post(url: string, options?: RequestOptions): Promise<HttpResponse> {
    return Promise.resolve().then(() => this.handle('POST', url, options));
  }

  /** Alle Sitzungen verfallen (Timeout, Neustart der FRITZ!Box). */
  expireSessions() {
    this.sessions.clear();
  }

  homeautoRequests() {
    return this.requests.filter(
      (request) => request.url.pathname === '/webservices/homeautoswitch.lua',
    );
  }

  private handle(
    method: 'GET' | 'POST',
    rawUrl: string,
    options?: RequestOptions,
  ): HttpResponse {
    const request: RecordedRequest = {
      method,
      url: new URL(rawUrl),
      rawUrl,
      body: typeof options?.body === 'string' ? options.body : undefined,
      headers: options?.headers,
    };
    this.requests.push(request);

    for (const interceptor of this.interceptors) {
      const result = interceptor(request);
      if (result instanceof Error) {
        throw result;
      }
      if (result) {
        return result;
      }
    }

    const { url } = request;
    if (url.pathname === '/login_sid.lua') {
      return this.login(request);
    }
    if (url.pathname === '/webservices/homeautoswitch.lua') {
      return this.homeauto(url);
    }
    return response(404);
  }

  private login({ method, url, body }: RecordedRequest): HttpResponse {
    if (url.searchParams.get('logout') === '1') {
      this.sessions.delete(url.searchParams.get('sid') ?? '');
      this.logouts++;
      return response(200, sessionInfo('0000000000000000', this.challenge, 0));
    }

    if (method === 'GET') {
      return response(
        200,
        sessionInfo('0000000000000000', this.challenge, this.blockTime),
      );
    }

    const form = new URLSearchParams(body);
    if (
      form.get('username') === USER &&
      form.get('response') ===
        expectedPbkdf2Response(this.challenge, this.password)
    ) {
      const sid = (++this.sidCounter).toString(16).padStart(16, 'a');
      this.sessions.add(sid);
      this.logins++;
      return response(200, sessionInfo(sid, this.challenge, 0));
    }

    this.failedLogins++;
    return response(200, sessionInfo('0000000000000000', this.challenge, 8));
  }

  private homeauto(url: URL): HttpResponse {
    if (!this.sessions.has(url.searchParams.get('sid') ?? '')) {
      return response(403);
    }

    const ain = url.searchParams.get('ain') ?? '';
    switch (url.searchParams.get('switchcmd')) {
      case 'sethkrtsoll': {
        if (!this.knownAins.has(ain)) {
          return response(400);
        }
        const param = url.searchParams.get('param') ?? '';
        this.setCommands.push({ ain, param });
        return response(200, `${param}\n`);
      }
      default:
        return response(400);
    }
  }
}

function command(overrides: Partial<HeatingCommand> = {}): HeatingCommand {
  return {
    action: HeatingAction.HEAT,
    roomId: 1,
    roomTitle: 'Saal',
    avmId: THERMOSTAT_AIN,
    locationId: 1,
    targetTemperature: 21,
    eventId: 10,
    reason: 'Test',
    ...overrides,
  };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

/** Führt `fn` mit um `ms` vorgestellter Uhr (Date.now) aus. */
async function later<T>(ms: number, fn: () => Promise<T>): Promise<T> {
  const realNow = Date.now;
  const shifted = realNow() + ms;
  Date.now = () => shifted;
  try {
    return await fn();
  } finally {
    Date.now = realNow;
  }
}

describe('FRITZ!Box-Anbindung der Heizregeln', () => {
  let fritzBox: SimulatedFritzBox;
  let crypto: CryptoService;
  let locations: Map<number, AvmLocation>;
  let createdBoxes: FritzBoxConfig[];
  let connections: FritzboxConnectionService;
  let dispatcher: FritzboxHeatingCommandDispatcher;

  beforeAll(() => {
    process.env.APP_CRYPTO_KEY ??= '0123456789abcdef0123456789abcdef';
  });

  function location(overrides: Partial<AvmLocation> = {}): AvmLocation {
    return {
      id: 1,
      title: 'Gemeindehaus',
      ahaurl: 'http://192.168.178.1',
      ahauser: USER,
      ahapassword: crypto.encrypt(PASSWORD),
      ahasid: null,
      ...overrides,
    };
  }

  beforeEach(() => {
    fritzBox = new SimulatedFritzBox();
    crypto = new CryptoService();
    locations = new Map([[1, location()]]);
    createdBoxes = [];

    const locationRepo = {
      findOne: jest.fn(({ where: { id } }: { where: { id: number } }) =>
        Promise.resolve(locations.get(id) ?? null),
      ),
    };

    connections = new FritzboxConnectionService(
      locationRepo as never,
      crypto,
      (config) => {
        createdBoxes.push(config);
        return new FritzBox(config, fritzBox);
      },
    );
    dispatcher = new FritzboxHeatingCommandDispatcher(connections);
  });

  afterEach(async () => {
    await connections.onModuleDestroy();
  });

  describe('Login (PBKDF2)', () => {
    it('should compute the response of the AVM reference example', () => {
      expect(
        calculatePbkdf2Response('2$10000$5A1711$2000$5A1722', '1example!'),
      ).toBe(
        '5A1722$1798a1672bca7c6463d6b245f82b53703b0f50813401b03e4045a5861e689adb',
      );
    });

    it('should log in with the decrypted password and use the SID', async () => {
      await dispatcher.dispatch(command());

      expect(fritzBox.logins).toBe(1);
      const [challenge, login, set] = fritzBox.requests;
      expect(challenge.method).toBe('GET');
      expect(challenge.url.pathname).toBe('/login_sid.lua');
      expect(challenge.url.searchParams.get('version')).toBe('2');
      expect(login.method).toBe('POST');
      expect(login.headers?.['content-type']).toBe(
        'application/x-www-form-urlencoded',
      );
      expect(new URLSearchParams(login.body).get('username')).toBe(USER);
      expect(set.url.searchParams.get('sid')).toBe('aaaaaaaaaaaaaaa1');
      expect(createdBoxes[0]).toMatchObject({
        id: 'avm-location-1',
        ahaUrl: 'http://192.168.178.1',
        ahaUser: USER,
        ahaPassword: PASSWORD,
      });
    });

    it('should reject a wrong password and not retry within the cooldown', async () => {
      fritzBox.password = 'anderes-passwort';

      await expect(dispatcher.dispatch(command())).rejects.toMatchObject({
        cause: expect.any(AuthenticationError),
      });
      await expect(dispatcher.dispatch(command())).rejects.toMatchObject({
        cause: expect.any(AuthenticationError),
      });

      // Nur ein Fehlversuch, sonst verlängert die FRITZ!Box die Sperre.
      expect(fritzBox.failedLogins).toBe(1);
      expect(fritzBox.setCommands).toHaveLength(0);
    });

    it('should try to log in again after the cooldown', async () => {
      fritzBox.password = 'anderes-passwort';
      await expect(dispatcher.dispatch(command())).rejects.toThrow(
        FritzboxDispatchError,
      );

      fritzBox.password = PASSWORD;
      await later(AUTH_FAILURE_COOLDOWN_MS + 1, () =>
        dispatcher.dispatch(command()),
      );

      expect(fritzBox.failedLogins).toBe(1);
      expect(fritzBox.logins).toBe(1);
      expect(fritzBox.setCommands).toHaveLength(1);
    });

    it('should log in again right away when the credentials change', async () => {
      fritzBox.password = 'anderes-passwort';
      await expect(dispatcher.dispatch(command())).rejects.toThrow(
        FritzboxDispatchError,
      );

      fritzBox.password = 'neu';
      locations.set(1, location({ ahapassword: crypto.encrypt('neu') }));
      await dispatcher.dispatch(command());

      expect(fritzBox.failedLogins).toBe(1);
      expect(fritzBox.logins).toBe(1);
      expect(fritzBox.setCommands).toHaveLength(1);
    });

    it('should report a login block (BlockTime) as AuthenticationError', async () => {
      fritzBox.blockTime = 32;

      const error = await dispatcher.dispatch(command()).catch((e) => e);

      expect(error).toBeInstanceOf(FritzboxDispatchError);
      expect(error.cause).toBeInstanceOf(AuthenticationError);
      expect(error.message).toContain('32 seconds');
      expect(fritzBox.requests.some((r) => r.method === 'POST')).toBe(false);
    });
  });

  describe('Verbindungsverwaltung', () => {
    it('should log in only once for parallel commands', async () => {
      await Promise.all([
        dispatcher.dispatch(command({ roomId: 1 })),
        dispatcher.dispatch(command({ roomId: 2, avmId: GROUP_AIN })),
        dispatcher.dispatch(command({ roomId: 3, targetTemperature: 18 })),
        dispatcher.dispatch(command({ roomId: 4 })),
      ]);

      expect(fritzBox.logins).toBe(1);
      expect(createdBoxes).toHaveLength(1);
      expect(fritzBox.setCommands).toHaveLength(4);
    });

    it('should reuse the connection for subsequent commands', async () => {
      await dispatcher.dispatch(command());
      await dispatcher.dispatch(command({ action: HeatingAction.COOL }));

      expect(fritzBox.logins).toBe(1);
      expect(createdBoxes).toHaveLength(1);
    });

    it('should reconnect and log out the old session when credentials change', async () => {
      await dispatcher.dispatch(command());

      locations.set(
        1,
        location({
          ahaurl: 'http://fritz.box',
          ahapassword: crypto.encrypt(PASSWORD),
        }),
      );
      await dispatcher.dispatch(command());
      await flush();

      expect(createdBoxes).toHaveLength(2);
      expect(createdBoxes[1].ahaUrl).toBe('http://fritz.box');
      expect(fritzBox.logins).toBe(2);
      expect(fritzBox.logouts).toBe(1);
    });

    it('should reconnect after a connection error', async () => {
      await dispatcher.dispatch(command());

      fritzBox.interceptors = [() => new TypeError('fetch failed')];
      const error = await dispatcher.dispatch(command()).catch((e) => e);
      expect(error.cause).toBeInstanceOf(ConnectionError);

      fritzBox.interceptors = [];
      await dispatcher.dispatch(command());

      expect(createdBoxes).toHaveLength(2);
      expect(fritzBox.logins).toBe(2);
      expect(fritzBox.setCommands).toHaveLength(2);
    });

    it('should keep separate connections per AVM location', async () => {
      locations.set(2, location({ id: 2, ahaurl: 'http://192.168.179.1' }));

      await dispatcher.dispatch(command({ locationId: 1 }));
      await dispatcher.dispatch(command({ locationId: 2 }));

      expect(createdBoxes.map((config) => config.ahaUrl)).toEqual([
        'http://192.168.178.1',
        'http://192.168.179.1',
      ]);
    });

    it('should fail for unknown or incomplete AVM locations', async () => {
      locations.set(2, location({ id: 2, ahapassword: null }));

      await expect(
        dispatcher.dispatch(command({ locationId: 99 })),
      ).rejects.toThrow('AVM-Location #99 existiert nicht');
      await expect(
        dispatcher.dispatch(command({ locationId: 2 })),
      ).rejects.toThrow('keine vollständigen FRITZ!Box-Zugangsdaten');
      expect(fritzBox.requests).toHaveLength(0);
    });
  });

  describe('Sitzungsablauf (403)', () => {
    it('should log in again and repeat the command after a 403', async () => {
      await dispatcher.dispatch(command());
      fritzBox.expireSessions();

      await dispatcher.dispatch(command({ targetTemperature: 16 }));

      expect(fritzBox.logins).toBe(2);
      expect(createdBoxes).toHaveLength(1);
      expect(fritzBox.setCommands).toEqual([
        { ain: THERMOSTAT_AIN, param: '42' },
        { ain: THERMOSTAT_AIN, param: '32' },
      ]);
      // gesendet, 403, nach neuem Login wiederholt
      expect(fritzBox.homeautoRequests()).toHaveLength(3);
    });

    it('should throw a SessionError when the new session is rejected as well', async () => {
      await dispatcher.dispatch(command());
      fritzBox.interceptors = [
        ({ url }) =>
          url.pathname === '/webservices/homeautoswitch.lua'
            ? response(403)
            : undefined,
      ];

      const error = await dispatcher.dispatch(command()).catch((e) => e);
      expect(error.cause).toBeInstanceOf(SessionError);

      // Verbindung wird verworfen, der nächste Lauf verbindet neu.
      fritzBox.interceptors = [];
      await dispatcher.dispatch(command());
      expect(createdBoxes).toHaveLength(2);
    });
  });

  describe('AIN (Thermostat und Gruppe)', () => {
    it('should address a group AIN with sethkrtsoll', async () => {
      await dispatcher.dispatch(command({ avmId: GROUP_AIN }));

      const [request] = fritzBox.homeautoRequests();
      expect(request.url.searchParams.get('switchcmd')).toBe('sethkrtsoll');
      expect(request.url.searchParams.get('ain')).toBe(GROUP_AIN);
      expect(request.url.searchParams.get('param')).toBe('42');
    });

    it('should send a thermostat AIN with its space form-encoded', async () => {
      await dispatcher.dispatch(command({ avmId: THERMOSTAT_AIN }));

      const [request] = fritzBox.homeautoRequests();
      expect(request.rawUrl).toContain('ain=09995+0179707');
      expect(request.url.searchParams.get('ain')).toBe(THERMOSTAT_AIN);
    });

    it('should fail for an AIN the FRITZ!Box does not know', async () => {
      const error = await dispatcher
        .dispatch(command({ avmId: '12345 6789012' }))
        .catch((e) => e);

      expect(error).toBeInstanceOf(FritzboxDispatchError);
      expect(error.cause).toBeInstanceOf(ProtocolError);
      expect(error.message).toContain('HTTP 400');
    });
  });

  describe('Temperaturumrechnung', () => {
    it.each<[number | string, number]>([
      [21, 21],
      [21.5, 21.5],
      [20.3, 20.5],
      [20.2, 20],
      [8, 8],
      [28, 28],
      [5, 8],
      [0, 8],
      [-3, 8],
      [30, 28],
      ['19', 19],
    ])('should normalize %p °C to %p °C', (input, expected) => {
      expect(toFritzboxTemperature(input)).toBe(expected);
    });

    it.each([NaN, Infinity, '', 'warm', null, undefined])(
      'should reject the invalid temperature %p',
      (input) => {
        expect(() => toFritzboxTemperature(input as never)).toThrow(
          'Ungültige Zieltemperatur',
        );
      },
    );

    it.each<[number, string]>([
      [8, '16'],
      [16, '32'],
      [21, '42'],
      [21.5, '43'],
      [28, '56'],
      [35, '56'],
      [4, '16'],
      [19.8, '40'],
    ])(
      'should send %p °C as AHA value %p',
      async (temperature, expectedParam) => {
        await dispatcher.dispatch(command({ targetTemperature: temperature }));

        expect(fritzBox.setCommands).toEqual([
          { ain: THERMOSTAT_AIN, param: expectedParam },
        ]);
      },
    );

    it('should not send anything for an invalid temperature', async () => {
      await expect(
        dispatcher.dispatch(command({ targetTemperature: NaN })),
      ).rejects.toThrow('Ungültige Zieltemperatur');
      expect(fritzBox.requests).toHaveLength(0);
    });

    it('should let the library reject values outside 8-28 °C or 0.5 °C steps', async () => {
      const box = new FritzBox(
        {
          id: 'direct',
          title: 'Direkt',
          ahaUrl: 'http://192.168.178.1',
          ahaUser: USER,
          ahaPassword: PASSWORD,
        },
        fritzBox,
      );
      const thermostat = box.thermostats.get(THERMOSTAT_AIN);

      await expect(thermostat.setTemperature(28.5)).rejects.toThrow(
        InvalidTemperatureError,
      );
      await expect(thermostat.setTemperature(7.5)).rejects.toThrow(
        InvalidTemperatureError,
      );
      await expect(thermostat.setTemperature(21.3)).rejects.toThrow(
        InvalidTemperatureError,
      );
      expect(fritzBox.requests).toHaveLength(0);
    });
  });

  describe('Fehlerfälle', () => {
    it('should throw on HTTP 500 and keep the connection', async () => {
      await dispatcher.dispatch(command());
      fritzBox.interceptors = [
        ({ url }) =>
          url.searchParams.get('switchcmd') === 'sethkrtsoll'
            ? response(500)
            : undefined,
      ];

      const error = await dispatcher.dispatch(command()).catch((e) => e);
      expect(error).toBeInstanceOf(FritzboxDispatchError);
      expect(error.cause).toBeInstanceOf(ProtocolError);
      expect(error.message).toContain(
        'FRITZ!Box von AVM-Location #1 (AIN 09995 0179707)',
      );

      fritzBox.interceptors = [];
      await dispatcher.dispatch(command());
      expect(createdBoxes).toHaveLength(1);
      expect(fritzBox.logins).toBe(1);
    });

    it('should throw on a non-numeric answer', async () => {
      fritzBox.interceptors = [
        ({ url }) =>
          url.searchParams.get('switchcmd') === 'sethkrtsoll'
            ? response(200, 'inval')
            : undefined,
      ];

      const error = await dispatcher.dispatch(command()).catch((e) => e);
      expect(error.cause).toBeInstanceOf(ProtocolError);
    });

    it('should retry on HTTP 503 and then succeed', async () => {
      let failures = 1;
      fritzBox.interceptors = [
        ({ url }) =>
          url.searchParams.get('switchcmd') === 'sethkrtsoll' && failures-- > 0
            ? response(503)
            : undefined,
      ];

      await dispatcher.dispatch(command());

      expect(fritzBox.setCommands).toHaveLength(1);
      expect(fritzBox.homeautoRequests()).toHaveLength(2);
    });

    it('should give up after three failed network attempts', async () => {
      fritzBox.interceptors = [() => new TypeError('fetch failed')];

      const error = await dispatcher.dispatch(command()).catch((e) => e);

      expect(error.cause).toBeInstanceOf(ConnectionError);
      expect(fritzBox.requests).toHaveLength(3);
    });
  });

  describe('Nicht erreichbare FRITZ!Box', () => {
    it('should fail fast for further rooms and retry after the cooldown', async () => {
      fritzBox.interceptors = [() => new TypeError('fetch failed')];

      await expect(dispatcher.dispatch(command())).rejects.toThrow(
        FritzboxDispatchError,
      );
      const second = await dispatcher
        .dispatch(command({ roomId: 2 }))
        .catch((e) => e);

      expect(second.cause).toBeInstanceOf(ConnectionError);
      expect(second.message).toContain('nächster Versuch ab');
      // Nur die drei Versuche des ersten Raums, der zweite scheitert sofort.
      expect(fritzBox.requests).toHaveLength(3);

      fritzBox.interceptors = [];
      await later(CONNECT_FAILURE_COOLDOWN_MS + 1, () =>
        dispatcher.dispatch(command()),
      );
      expect(fritzBox.setCommands).toHaveLength(1);
    });
  });

  describe('Zusammenspiel mit HeatingRulesService', () => {
    const NOW = new Date('2026-01-15T12:00:00');
    const at = (min: number) => new Date(NOW.getTime() + min * 60_000);
    let moduleRef: TestingModule;
    let service: HeatingRulesService;
    let rooms: Room[];
    const roomRepo = {
      find: jest.fn(() => Promise.resolve(rooms)),
      update: jest.fn(() => Promise.resolve()),
    };
    const qb: Record<string, jest.Mock> = {};
    for (const m of ['where', 'andWhere', 'orderBy']) {
      qb[m] = jest.fn(() => qb);
    }
    qb.getMany = jest.fn(() =>
      Promise.resolve([
        { id: 10, title: 'Chor', roomid: 1, start: at(30), end: at(120) },
      ]),
    );

    beforeEach(async () => {
      jest.clearAllMocks();
      rooms = [
        {
          id: 1,
          title: 'Saal',
          avm_id: GROUP_AIN,
          comfort_temp: 21,
          empty_temp: 16,
          prelim_time: 60,
          heated: false,
          locationid: 1,
        } as Room,
      ];
      const config: HeatingConfig = {
        enabled: true,
        seasonStart: null,
        seasonEnd: null,
        hallwayRoomId: null,
      };

      moduleRef = await Test.createTestingModule({
        providers: [
          HeatingRulesService,
          FritzboxConnectionService,
          {
            provide: HEATING_COMMAND_DISPATCHER,
            useClass: FritzboxHeatingCommandDispatcher,
          },
          {
            provide: FRITZBOX_FACTORY,
            useValue: (config: FritzBoxConfig) =>
              new FritzBox(config, fritzBox),
          },
          { provide: CryptoService, useValue: crypto },
          {
            provide: getRepositoryToken(AvmLocation),
            useValue: {
              findOne: () => Promise.resolve(locations.get(1)),
            },
          },
          { provide: getRepositoryToken(Room), useValue: roomRepo },
          {
            provide: getRepositoryToken(CalendarEvent),
            useValue: { createQueryBuilder: jest.fn(() => qb) },
          },
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

      service = moduleRef.get(HeatingRulesService);
    });

    afterEach(async () => {
      await moduleRef.close();
    });

    it('should set comfort_temp on the group and store heated', async () => {
      const result = await service.run(NOW);

      expect(fritzBox.setCommands).toEqual([{ ain: GROUP_AIN, param: '42' }]);
      expect(roomRepo.update).toHaveBeenCalledWith(1, { heated: true });
      expect(result.rooms[0].status).toBe('sent');
    });

    it('should set empty_temp when cooling down', async () => {
      rooms[0].heated = true;
      qb.getMany.mockResolvedValueOnce([
        { id: 10, title: 'Chor', roomid: 1, start: at(-120), end: at(-2) },
      ]);

      await service.run(NOW);

      expect(fritzBox.setCommands).toEqual([{ ain: GROUP_AIN, param: '32' }]);
      expect(roomRepo.update).toHaveBeenCalledWith(1, { heated: false });
    });

    it('should keep heated unchanged on failure and retry in the next run', async () => {
      fritzBox.interceptors = [
        ({ url }) =>
          url.searchParams.get('switchcmd') === 'sethkrtsoll'
            ? response(500)
            : undefined,
      ];

      const failed = await service.run(NOW);

      expect(failed.rooms[0].status).toBe('failed');
      expect(failed.rooms[0].error).toContain('HTTP 500');
      expect(failed.rooms[0].heatedAfter).toBe(false);
      expect(roomRepo.update).not.toHaveBeenCalled();

      fritzBox.interceptors = [];
      const retried = await service.run(NOW);

      expect(retried.rooms[0].status).toBe('sent');
      expect(fritzBox.setCommands).toEqual([{ ain: GROUP_AIN, param: '42' }]);
      expect(roomRepo.update).toHaveBeenCalledWith(1, { heated: true });
    });
  });
});
