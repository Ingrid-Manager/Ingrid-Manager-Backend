import { pbkdf2Sync } from 'node:crypto';
import { UnprocessableEntityException } from '@nestjs/common';
import { Repository } from 'typeorm';

import { FritzBox } from '../../libs/fritzbox-aha/index.js';
import type {
  FritzBoxConfig,
  HttpResponse,
  HttpTransport,
  RequestOptions,
} from '../../libs/fritzbox-aha/index.js';
import { FritzBoxConnectionService } from './fritzbox-connection.service';
import { FritzBoxHeatingCommandDispatcher } from '../dispatcher/fritzbox-heating-command-dispatcher';
import { HeatingCommand } from '../dispatcher/heating-command-dispatcher';
import { HeatingAction } from '../domain/heating-rules';
import { AvmLocation } from '../../avm-locations/infrastructure/relational/persistence/entities/avm-location.entity';
import { CryptoService } from '../../crypto/crypto.service';

const SALT1 = 'aabbccdd';
const SALT2 = '11223344';
const CHALLENGE = `2$10$${SALT1}$20$${SALT2}`;

function expectedResponse(password: string): string {
  const hash1 = pbkdf2Sync(
    Buffer.from(password, 'utf8'),
    Buffer.from(SALT1, 'hex'),
    10,
    32,
    'sha256',
  );
  const hash2 = pbkdf2Sync(hash1, Buffer.from(SALT2, 'hex'), 20, 32, 'sha256');
  return `${SALT2}$${hash2.toString('hex')}`;
}

const DEVICE_LIST = `<?xml version="1.0" encoding="UTF-8"?>
<devicelist version="1">
  <device identifier="09995 0179707" id="17" functionbitmask="320" fwversion="05.08" manufacturer="AVM" productname="FRITZ!DECT 301">
    <present>1</present>
    <name>Saal Thermostat</name>
    <battery>80</battery>
    <batterylow>0</batterylow>
    <hkr><tist>40</tist><tsoll>32</tsoll><komfort>42</komfort><absenk>32</absenk></hkr>
  </device>
  <group identifier="grp303E4F-3F7A1B8C7" id="900" functionbitmask="4160">
    <present>1</present>
    <name>Saal</name>
    <groupinfo><masterdeviceid>0</masterdeviceid><members>17</members></groupinfo>
  </group>
</devicelist>`;

function sessionInfo(sid: string, challenge = CHALLENGE): string {
  return `<?xml version="1.0" encoding="utf-8"?><SessionInfo><SID>${sid}</SID><Challenge>${challenge}</Challenge><BlockTime>0</BlockTime><Rights></Rights></SessionInfo>`;
}

/** Minimaler FRITZ!Box-Simulator für login_sid.lua und homeautoswitch.lua. */
class FakeFritzBoxTransport implements HttpTransport {
  password: string;
  readonly user: string;
  validSids = new Set<string>();
  logins = 0;
  setCalls: { ain: string; param: string }[] = [];
  private sidCounter = 0;

  constructor(user: string, password: string) {
    this.user = user;
    this.password = password;
  }

  get(url: string): Promise<HttpResponse> {
    const parsed = new URL(url);
    if (parsed.pathname === '/login_sid.lua') {
      const sid = parsed.searchParams.get('sid');
      if (parsed.searchParams.get('logout') && sid) {
        this.validSids.delete(sid);
      }
      return this.respond(200, sessionInfo('0000000000000000'));
    }

    if (parsed.pathname === '/webservices/homeautoswitch.lua') {
      const sid = parsed.searchParams.get('sid') ?? '';
      if (!this.validSids.has(sid)) {
        return this.respond(403, '');
      }
      const ain = (parsed.searchParams.get('ain') ?? '').replace(/\s+/g, '');
      switch (parsed.searchParams.get('switchcmd')) {
        case 'getdevicelistinfos':
          return this.respond(200, DEVICE_LIST);
        case 'sethkrtsoll':
          if (ain !== '099950179707' && ain !== 'grp303E4F-3F7A1B8C7') {
            return this.respond(400, 'inval\n');
          }
          this.setCalls.push({
            ain,
            param: parsed.searchParams.get('param') ?? '',
          });
          return this.respond(200, `${parsed.searchParams.get('param')}\n`);
        case 'gettemperature':
          return this.respond(200, '205\n');
        case 'gethkrtsoll':
          return this.respond(200, '42\n');
        case 'gethkrkomfort':
          return this.respond(200, '42\n');
        case 'gethkrabsenk':
          return this.respond(200, '32\n');
        default:
          return this.respond(400, '');
      }
    }

    return this.respond(404, '');
  }

  post(url: string, options: RequestOptions = {}): Promise<HttpResponse> {
    const body = new URLSearchParams(String(options.body ?? ''));
    if (
      body.get('username') === this.user &&
      body.get('response') === expectedResponse(this.password)
    ) {
      this.logins += 1;
      const sid = `${++this.sidCounter}`.padStart(16, 'a');
      this.validSids.add(sid);
      return this.respond(200, sessionInfo(sid));
    }
    return this.respond(200, sessionInfo('0000000000000000'));
  }

  private respond(status: number, body: string): Promise<HttpResponse> {
    return Promise.resolve({ status, body, headers: new Headers() });
  }
}

/** "Verschlüsselung" für den Test: Passwort mit Präfix. */
const cryptoService = {
  decrypt: (value: string) => value.replace(/^enc:/, ''),
} as unknown as CryptoService;

class TestFritzBoxService extends FritzBoxConnectionService {
  constructor(
    locationRepo: Repository<AvmLocation>,
    private readonly transport: FakeFritzBoxTransport,
  ) {
    super(locationRepo, cryptoService);
  }

  protected createFritzBox(config: FritzBoxConfig): FritzBox {
    return new FritzBox(config, this.transport);
  }
}

describe('FritzBoxConnectionService / FritzBoxHeatingCommandDispatcher', () => {
  let location: AvmLocation;
  let transport: FakeFritzBoxTransport;
  let locationRepo: { findOne: jest.Mock };
  let service: TestFritzBoxService;
  let dispatcher: FritzBoxHeatingCommandDispatcher;

  const command = (
    overrides: Partial<HeatingCommand> = {},
  ): HeatingCommand => ({
    action: HeatingAction.HEAT,
    roomId: 1,
    roomTitle: 'Saal',
    avmId: '09995 0179707',
    locationId: 1,
    targetTemperature: 21,
    eventId: 5,
    reason: 'Termin',
    ...overrides,
  });

  beforeEach(() => {
    location = {
      id: 1,
      title: 'Gemeindehaus',
      ahaurl: '192.168.178.1',
      ahauser: 'smarthome',
      ahapassword: 'enc:geheim',
    };
    transport = new FakeFritzBoxTransport('smarthome', 'geheim');
    locationRepo = {
      findOne: jest.fn(() => Promise.resolve({ ...location })),
    };
    service = new TestFritzBoxService(
      locationRepo as unknown as Repository<AvmLocation>,
      transport,
    );
    dispatcher = new FritzBoxHeatingCommandDispatcher(service);
  });

  it('meldet sich per PBKDF2 an und setzt die Zieltemperatur (°C * 2)', async () => {
    await dispatcher.dispatch(command());

    expect(transport.logins).toBe(1);
    expect(transport.setCalls).toEqual([{ ain: '099950179707', param: '42' }]);
  });

  it('setzt beim Absenken die empty_temp und nutzt die Session weiter', async () => {
    await dispatcher.dispatch(command());
    await dispatcher.dispatch(
      command({ action: HeatingAction.COOL, targetTemperature: 16 }),
    );

    expect(transport.logins).toBe(1);
    expect(transport.setCalls.map((call) => call.param)).toEqual(['42', '32']);
  });

  it('schaltet auch Thermostat-Gruppen', async () => {
    await dispatcher.dispatch(command({ avmId: 'grp303E4F-3F7A1B8C7' }));

    expect(transport.setCalls).toEqual([
      { ain: 'grp303E4F-3F7A1B8C7', param: '42' },
    ]);
  });

  it('meldet sich nach abgelaufener Session automatisch neu an', async () => {
    await dispatcher.dispatch(command());
    transport.validSids.clear();

    await dispatcher.dispatch(command({ targetTemperature: 20 }));

    expect(transport.logins).toBe(2);
    expect(transport.setCalls.map((call) => call.param)).toEqual(['42', '40']);
  });

  it('bringt Temperaturen in den Bereich der FRITZ!Box (8-28 °C, 0,5er Schritte)', async () => {
    await dispatcher.dispatch(command({ targetTemperature: 5 }));
    await dispatcher.dispatch(command({ targetTemperature: 30 }));
    await dispatcher.dispatch(command({ targetTemperature: 20.3 }));

    expect(transport.setCalls.map((call) => call.param)).toEqual([
      '16',
      '56',
      '41',
    ]);
  });

  it('wirft bei falschem Passwort, damit der Raumzustand unverändert bleibt', async () => {
    location.ahapassword = 'enc:falsch';

    await expect(dispatcher.dispatch(command())).rejects.toThrow(
      'FRITZ!Box authentication failed',
    );
    expect(transport.setCalls).toHaveLength(0);
  });

  it('wirft bei unbekannter AIN', async () => {
    await expect(
      dispatcher.dispatch(command({ avmId: '12345 6789012' })),
    ).rejects.toThrow('HTTP 400');
  });

  it('verbindet neu, wenn sich die Zugangsdaten der Location ändern', async () => {
    await dispatcher.dispatch(command());
    transport.password = 'neu';
    location.ahapassword = 'enc:neu';

    await dispatcher.dispatch(command());

    expect(transport.logins).toBe(2);
  });

  it('meldet unvollständige oder fehlende AVM Locations', async () => {
    location.ahapassword = null;
    await expect(dispatcher.dispatch(command())).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );

    locationRepo.findOne.mockResolvedValueOnce(null);
    await expect(dispatcher.dispatch(command())).rejects.toThrow(
      'AVM Location 1 not found',
    );
    expect(transport.setCalls).toHaveLength(0);
  });

  it('meldet sich bei parallelen Befehlen nur einmal an', async () => {
    await Promise.all([
      dispatcher.dispatch(command()),
      dispatcher.dispatch(command({ avmId: 'grp303E4F-3F7A1B8C7' })),
    ]);

    expect(transport.logins).toBe(1);
    expect(transport.setCalls).toHaveLength(2);
  });

  it('verbindet nach einem Protokollfehler neu', async () => {
    await expect(
      dispatcher.dispatch(command({ avmId: '12345 6789012' })),
    ).rejects.toThrow('HTTP 400');

    await dispatcher.dispatch(command());

    expect(transport.logins).toBe(2);
    expect(transport.setCalls).toHaveLength(1);
  });

  it('meldet sich beim Herunterfahren ab', async () => {
    await dispatcher.dispatch(command());
    expect(transport.validSids.size).toBe(1);

    await service.onModuleDestroy();

    expect(transport.validSids.size).toBe(0);
  });
});
