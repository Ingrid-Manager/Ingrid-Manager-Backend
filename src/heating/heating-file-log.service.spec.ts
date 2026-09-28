import { ConfigService } from '@nestjs/config';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { AllConfigType } from '../config/config.type';
import { HeatingConfig } from './config/heating-config.type';
import {
  HeatingFileLogService,
  formatLocalTime,
} from './heating-file-log.service';

describe('HeatingFileLogService', () => {
  let directory: string;

  const service = (config: Partial<HeatingConfig>) =>
    new HeatingFileLogService({
      get: () => ({
        hallwayRoomIds: [],
        schedulerEnabled: true,
        ...config,
      }),
    } as unknown as ConfigService<AllConfigType>);

  const readLines = async (file: string) =>
    (await readFile(file, 'utf8'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as Record<string, unknown>);

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'heating-log-'));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('should append one JSON line per entry and create the directory', async () => {
    const file = join(directory, 'nested', 'heating.log');
    const log = service({ logFile: file });
    const at = new Date('2026-09-28T08:57:00.000Z');

    await log.write(
      { event: 'HEATING_ERROR', summary: 'first', code: 'X' },
      at,
    );
    await log.write({ event: 'HEATING_RECOVERED', summary: 'second' }, at);

    const lines = await readLines(file);

    expect(lines).toHaveLength(2);
    expect(lines[0]).toEqual({
      timestamp: '2026-09-28T08:57:00.000Z',
      localTime: formatLocalTime(at),
      event: 'HEATING_ERROR',
      summary: 'first',
      code: 'X',
    });
    expect(lines[1].event).toBe('HEATING_RECOVERED');
  });

  it('should keep the order of concurrent writes', async () => {
    const file = join(directory, 'heating.log');
    const log = service({ logFile: file });

    await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        log.write({ event: 'HEATING_ERROR', summary: String(index) }),
      ),
    );

    expect((await readLines(file)).map((line) => line.summary)).toEqual(
      Array.from({ length: 20 }, (_, index) => String(index)),
    );
  });

  it('should rotate the file when it exceeds the maximum size', async () => {
    const file = join(directory, 'heating.log');
    await writeFile(file, 'x'.repeat(1024 * 1024));
    const log = service({ logFile: file, logFileMaxSizeMb: 1 });

    await log.write({ event: 'HEATING_ERROR', summary: 'after rotation' });

    expect((await stat(`${file}.1`)).size).toBe(1024 * 1024);
    expect((await readLines(file)).map((line) => line.summary)).toEqual([
      'after rotation',
    ]);
  });

  it('should write nothing when disabled', async () => {
    const file = join(directory, 'heating.log');
    const log = service({ logFile: null });

    await log.write({ event: 'HEATING_ERROR', summary: 'ignored' });

    await expect(stat(file)).rejects.toThrow();
  });

  it('should never throw when the file cannot be written', async () => {
    // Ein Verzeichnis kann nicht als Datei beschrieben werden.
    const log = service({ logFile: directory });

    await expect(
      log.write({ event: 'HEATING_ERROR', summary: 'lost' }),
    ).resolves.toBeUndefined();
  });

  it('should format the local time with the UTC offset', () => {
    expect(formatLocalTime(new Date())).toMatch(
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} [+-]\d{2}:\d{2}$/,
    );
  });
});
