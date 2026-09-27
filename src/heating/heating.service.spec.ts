import {
  ConnectionError,
  InvalidTemperatureError,
} from '../libs/fritzbox-aha/index.js';

import { HeatingService } from './heating.service';
import { FritzBoxConnectionManager } from './fritzbox-connection-manager.service';
import { HeatingAction } from './domain/heating-action';
import { HeatingError, HeatingErrorCode } from './domain/heating-error';

type FakeDevice = { ain: string; present?: boolean };

function createFakeBox(devices: FakeDevice[], groups: string[] = []) {
  const setTemperature = jest.fn<Promise<void>, [string, number]>(() =>
    Promise.resolve(),
  );

  return {
    setTemperature,
    listDevices: jest.fn(() =>
      Promise.resolve(
        devices.map((device) => ({
          ain: device.ain,
          present: device.present ?? true,
        })),
      ),
    ),
    isGroup: jest.fn((ain: string) => Promise.resolve(groups.includes(ain))),
    thermostats: {
      get: jest.fn((ain: string) => ({
        setTemperature: (temperature: number) =>
          setTemperature(ain, temperature),
      })),
    },
  };
}

const action = (overrides: Partial<HeatingAction> = {}): HeatingAction => ({
  roomId: 1,
  locationId: 10,
  action: 'HEAT',
  targetTemperature: 21,
  avmId: 'AIN-1',
  eventId: 1,
  reason: 'EVENT_PRELIM',
  ...overrides,
});

describe('HeatingService.executeLocationActions', () => {
  let boxes: Map<number, ReturnType<typeof createFakeBox>>;
  let connections: {
    getConnection: jest.Mock;
    invalidate: jest.Mock;
  };
  let service: HeatingService;

  beforeEach(() => {
    boxes = new Map([
      [
        10,
        createFakeBox(
          [{ ain: 'AIN-1' }, { ain: 'AIN-2', present: false }],
          ['GROUP-1'],
        ),
      ],
      [20, createFakeBox([{ ain: 'AIN-B' }])],
    ]);
    connections = {
      getConnection: jest.fn((locationId: number) => {
        const box = boxes.get(locationId);

        if (!box) {
          return Promise.reject(
            new HeatingError(HeatingErrorCode.UNKNOWN_LOCATION, 'unknown', {
              locationId,
            }),
          );
        }

        return Promise.resolve(box);
      }),
      invalidate: jest.fn(() => Promise.resolve()),
    };
    service = new HeatingService(
      connections as unknown as FritzBoxConnectionManager,
    );
  });

  it('should set the target temperature on the FRITZ!Box of the location', async () => {
    const results = await service.executeLocationActions(10, [action()]);

    expect(results).toEqual([{ action: action(), status: 'applied' }]);
    expect(connections.getConnection).toHaveBeenCalledWith(10);
    expect(boxes.get(10).setTemperature).toHaveBeenCalledWith('AIN-1', 21);
    expect(boxes.get(20).setTemperature).not.toHaveBeenCalled();
  });

  it('should support AVM groups as avm_id', async () => {
    const results = await service.executeLocationActions(10, [
      action({ avmId: 'GROUP-1', action: 'COOL', targetTemperature: 16 }),
    ]);

    expect(results[0].status).toBe('applied');
    expect(boxes.get(10).setTemperature).toHaveBeenCalledWith('GROUP-1', 16);
  });

  it('should never send actions of another location', async () => {
    const results = await service.executeLocationActions(10, [
      action({ locationId: 20, avmId: 'AIN-B' }),
    ]);

    expect(results[0].status).toBe('failed');
    expect((results[0].error as HeatingError).code).toBe(
      HeatingErrorCode.CONFIGURATION_ERROR,
    );
    expect(boxes.get(10).setTemperature).not.toHaveBeenCalled();
    expect(boxes.get(20).setTemperature).not.toHaveBeenCalled();
  });

  it('should reject invalid temperatures without contacting the FRITZ!Box', async () => {
    const results = await service.executeLocationActions(10, [
      action({ targetTemperature: 35 }),
      action({ roomId: 2, targetTemperature: 20.3 }),
      action({ roomId: 3, targetTemperature: Number.NaN }),
    ]);

    expect(results.map((r) => (r.error as HeatingError).code)).toEqual([
      HeatingErrorCode.INVALID_TEMPERATURE,
      HeatingErrorCode.INVALID_TEMPERATURE,
      HeatingErrorCode.INVALID_TEMPERATURE,
    ]);
    expect(connections.getConnection).not.toHaveBeenCalled();
  });

  it('should skip rooms without avm_id without connecting', async () => {
    const results = await service.executeLocationActions(10, [
      action({ avmId: null }),
    ]);

    expect(results[0].status).toBe('skipped');
    expect(connections.getConnection).not.toHaveBeenCalled();
  });

  it('should report unknown and absent thermostats per action', async () => {
    const results = await service.executeLocationActions(10, [
      action({ roomId: 1, avmId: 'UNKNOWN' }),
      action({ roomId: 2, avmId: 'AIN-2' }),
      action({ roomId: 3, avmId: 'AIN-1' }),
    ]);

    expect(results.map((r) => r.status)).toEqual([
      'failed',
      'failed',
      'applied',
    ]);
    expect((results[0].error as HeatingError).code).toBe(
      HeatingErrorCode.THERMOSTAT_UNREACHABLE,
    );
    expect((results[1].error as HeatingError).code).toBe(
      HeatingErrorCode.THERMOSTAT_UNREACHABLE,
    );
    expect(boxes.get(10).setTemperature).toHaveBeenCalledTimes(1);
  });

  it('should fail all device actions when the location cannot be resolved', async () => {
    const results = await service.executeLocationActions(30, [
      action({ locationId: 30 }),
      action({ locationId: 30, roomId: 2, avmId: null }),
    ]);

    expect(results[0].status).toBe('failed');
    expect((results[0].error as HeatingError).code).toBe(
      HeatingErrorCode.UNKNOWN_LOCATION,
    );
    expect(results[1].status).toBe('skipped');
  });

  it('should classify errors of the FRITZ!Box library', async () => {
    const box = boxes.get(10);
    box.setTemperature
      .mockRejectedValueOnce(new InvalidTemperatureError('bad value'))
      .mockRejectedValueOnce(new ConnectionError('network down'));

    const results = await service.executeLocationActions(10, [
      action({ roomId: 1 }),
      action({ roomId: 2 }),
      action({ roomId: 3 }),
    ]);

    expect(results.map((r) => (r.error as HeatingError).code)).toEqual([
      HeatingErrorCode.INVALID_TEMPERATURE,
      HeatingErrorCode.FRITZBOX_UNREACHABLE,
      HeatingErrorCode.FRITZBOX_UNREACHABLE,
    ]);
    // Nach dem Verbindungsfehler wird die Verbindung verworfen und die
    // restliche Aktion nicht mehr gesendet.
    expect(connections.invalidate).toHaveBeenCalledWith(10);
    expect(box.setTemperature).toHaveBeenCalledTimes(2);
  });
});
