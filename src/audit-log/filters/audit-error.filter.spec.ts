import {
  ArgumentsHost,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';

import { AuditErrorFilter } from './audit-error.filter';
import { AuditLogService } from '../audit-log.service';
import { AuditAction } from '../audit-action.enum';

function createHost(user?: { id: number }): ArgumentsHost {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ method: 'GET', url: '/test', user }),
      getResponse: () => ({}),
    }),
  } as unknown as ArgumentsHost;
}

describe('AuditErrorFilter', () => {
  let filter: AuditErrorFilter;
  let auditLogService: { log: jest.Mock };

  beforeEach(() => {
    auditLogService = { log: jest.fn().mockResolvedValue(undefined) };
    filter = new AuditErrorFilter(auditLogService as unknown as AuditLogService);

    // Die eigentliche Response-Behandlung von Nest wird hier nicht getestet -
    // nur, ob unser Filter vorher korrekt (nicht) loggt und danach delegiert.
    jest.spyOn(BaseExceptionFilter.prototype, 'catch').mockImplementation(
      () => undefined,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('logs a SYSTEM_ERROR entry for a 500 HttpException', async () => {
    await filter.catch(
      new InternalServerErrorException('Boom'),
      createHost({ id: 7 }),
    );

    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.SYSTEM_ERROR,
        user: { id: 7 },
        summary: expect.stringContaining('Boom'),
      }),
    );
  });

  it('logs a SYSTEM_ERROR entry for an unhandled, non-HttpException error', async () => {
    await filter.catch(new Error('unexpected crash'), createHost());

    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: AuditAction.SYSTEM_ERROR }),
    );
  });

  it('does not log for a 404 NotFoundException', async () => {
    await filter.catch(new NotFoundException('nope'), createHost());

    expect(auditLogService.log).not.toHaveBeenCalled();
  });

  it('does not log for a 400 BadRequestException', async () => {
    await filter.catch(new BadRequestException('invalid'), createHost());

    expect(auditLogService.log).not.toHaveBeenCalled();
  });
});
