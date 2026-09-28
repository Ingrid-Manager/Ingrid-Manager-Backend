import {
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import {
  ConfigurationError,
  ConnectionError,
  FritzBoxConfig,
  FritzBoxManager,
} from '../libs/fritzbox-aha/index.js';

import { AvmLocationsService } from '../avm-locations/avm-locations.service';
import { AvmConnection } from '../avm-locations/avm-connection.type';
import { FritzBoxConnectionManager } from './fritzbox-connection-manager.service';
import { HeatingError, HeatingErrorCode } from './domain/heating-error';

class FakeBox {
  connected = false;
  connect = jest.fn(() => {
    if (this.failConnect) {
      return Promise.reject(new ConnectionError('unreachable'));
    }
    this.connected = true;
    return Promise.resolve();
  });
  disconnect = jest.fn(() => {
    this.connected = false;
    return Promise.resolve();
  });

  constructor(
    readonly config: FritzBoxConfig,
    public failConnect = false,
  ) {}

  isConnected() {
    return this.connected;
  }
}

class FakeManager {
  readonly boxes = new Map<string, FakeBox>();
  failConnectFor = new Set<string>();

  add = jest.fn((config: FritzBoxConfig) => {
    if (this.boxes.has(config.id)) {
      throw new ConfigurationError(`duplicate ${config.id}`);
    }
    const box = new FakeBox(config, this.failConnectFor.has(config.id));
    this.boxes.set(config.id, box);
    return box;
  });

  remove = jest.fn(async (id: string) => {
    await this.boxes.get(id)?.disconnect();
    this.boxes.delete(id);
  });

  get(id: string) {
    return this.boxes.get(id);
  }

  disconnectAll = jest.fn(() => Promise.resolve([]));
}

const connectionFor = (locationId: number): AvmConnection => ({
  locationId,
  title: `Location ${locationId}`,
  url: `http://fritz-${locationId}.local`,
  username: `user-${locationId}`,
  password: `secret-${locationId}`,
});

describe('FritzBoxConnectionManager', () => {
  let manager: FakeManager;
  let connections: Map<number, AvmConnection | Error>;
  let avmLocationsService: { getConnection: jest.Mock };
  let connectionManager: FritzBoxConnectionManager;

  beforeEach(() => {
    manager = new FakeManager();
    connections = new Map<number, AvmConnection | Error>([
      [1, connectionFor(1)],
      [2, connectionFor(2)],
    ]);
    avmLocationsService = {
      getConnection: jest.fn((id: number) => {
        const connection = connections.get(id);
        if (!connection) {
          return Promise.reject(new NotFoundException());
        }
        if (connection instanceof Error) {
          return Promise.reject(connection);
        }
        return Promise.resolve(connection);
      }),
    };
    connectionManager = new FritzBoxConnectionManager(
      manager as unknown as FritzBoxManager,
      avmLocationsService as unknown as AvmLocationsService,
    );
  });

  it('should create one independent connection per location', async () => {
    const boxA = await connectionManager.getConnection(1);
    const boxB = await connectionManager.getConnection(2);

    expect(boxA).not.toBe(boxB);
    expect(boxA.config).toEqual({
      id: 'avm-location-1',
      title: 'Location 1',
      ahaUrl: 'http://fritz-1.local',
      ahaUser: 'user-1',
      ahaPassword: 'secret-1',
    });
    expect(boxB.config.ahaUrl).toBe('http://fritz-2.local');
    expect(boxA.isConnected()).toBe(true);
    expect(boxB.isConnected()).toBe(true);
  });

  it('should reuse an existing connection', async () => {
    const first = await connectionManager.getConnection(1);
    const second = await connectionManager.getConnection(1);

    expect(second).toBe(first);
    expect(manager.add).toHaveBeenCalledTimes(1);
    expect((first as unknown as FakeBox).connect).toHaveBeenCalledTimes(1);
  });

  it('should share a pending connection attempt', async () => {
    const [first, second] = await Promise.all([
      connectionManager.getConnection(1),
      connectionManager.getConnection(1),
    ]);

    expect(second).toBe(first);
    expect(manager.add).toHaveBeenCalledTimes(1);
  });

  it('should reconnect when the credentials of a location change', async () => {
    const first = await connectionManager.getConnection(1);

    connections.set(1, { ...connectionFor(1), password: 'changed' });
    const second = await connectionManager.getConnection(1);

    expect(second).not.toBe(first);
    expect(manager.remove).toHaveBeenCalledWith('avm-location-1');
    expect(second.config.ahaPassword).toBe('changed');
  });

  it('should report an unknown location', async () => {
    await expect(connectionManager.getConnection(404)).rejects.toMatchObject({
      code: HeatingErrorCode.UNKNOWN_LOCATION,
      context: { locationId: 404 },
    });
  });

  it('should report a location without FRITZ!Box configuration', async () => {
    connections.set(3, new UnprocessableEntityException());

    await expect(connectionManager.getConnection(3)).rejects.toMatchObject({
      code: HeatingErrorCode.MISSING_FRITZBOX_MAPPING,
    });
  });

  it('should report configuration errors', async () => {
    connections.set(4, new Error('bad decrypt'));

    await expect(connectionManager.getConnection(4)).rejects.toMatchObject({
      code: HeatingErrorCode.CONFIGURATION_ERROR,
    });
  });

  it('should report an unreachable FRITZ!Box without affecting other locations', async () => {
    manager.failConnectFor.add('avm-location-1');

    const error = await connectionManager
      .getConnection(1)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(HeatingError);
    expect((error as HeatingError).code).toBe(
      HeatingErrorCode.FRITZBOX_UNREACHABLE,
    );

    const boxB = await connectionManager.getConnection(2);
    expect(boxB.isConnected()).toBe(true);
  });

  it('should drop a connection on invalidate', async () => {
    const first = await connectionManager.getConnection(1);

    await connectionManager.invalidate(1);
    const second = await connectionManager.getConnection(1);

    expect(second).not.toBe(first);
    expect(manager.add).toHaveBeenCalledTimes(2);
  });

  it('should disconnect all FRITZ!Boxes before the application shuts down', async () => {
    await connectionManager.getConnection(1);

    await connectionManager.beforeApplicationShutdown();

    expect(manager.disconnectAll).toHaveBeenCalledTimes(1);
  });

  it('should not fail the shutdown when disconnecting fails', async () => {
    manager.disconnectAll.mockRejectedValueOnce(new Error('unreachable'));

    await expect(
      connectionManager.beforeApplicationShutdown(),
    ).resolves.toBeUndefined();
  });
});
