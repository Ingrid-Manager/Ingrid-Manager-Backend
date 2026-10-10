import { ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('should report ok when the database answers', async () => {
    const dataSource = { query: jest.fn().mockResolvedValue([{ 1: 1 }]) };
    const controller = new HealthController(
      dataSource as unknown as DataSource,
    );

    await expect(controller.check()).resolves.toEqual({
      status: 'ok',
      database: 'up',
    });
    expect(dataSource.query).toHaveBeenCalledWith('SELECT 1');
  });

  it('should answer with 503 when the database is not reachable', async () => {
    const dataSource = {
      query: jest.fn().mockRejectedValue(new Error('connection refused')),
    };
    const controller = new HealthController(
      dataSource as unknown as DataSource,
    );

    await expect(controller.check()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
