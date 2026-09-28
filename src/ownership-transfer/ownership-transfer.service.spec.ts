import { BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';

import { OwnershipTransferService } from './ownership-transfer.service';
import { SeriesEvent } from '../series-events/infrastructure/relational/persistence/entities/series-event.entity';
import { CalendarEvent } from '../calendar-events/infrastructure/relational/persistence/entities/calendar-event.entity';
import { UsersService } from '../users/users.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { StatusEnum } from '../statuses/statuses.enum';
import { RoleEnum } from '../roles/roles.enum';

describe('OwnershipTransferService', () => {
  let usersService: { findById: jest.Mock };
  let manager: {
    save: jest.Mock;
    count: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let service: OwnershipTransferService;

  beforeEach(() => {
    const queryBuilder = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 5 }),
    };
    manager = {
      save: jest.fn().mockResolvedValue(undefined),
      count: jest.fn().mockResolvedValue(3),
      createQueryBuilder: jest.fn(() => queryBuilder),
    };
    const seriesRepo = {
      findOne: jest
        .fn()
        .mockResolvedValue({ id: 7, title: 'Chor', createdbyid: 1 }),
      manager: {
        transaction: jest.fn((work: (m: typeof manager) => unknown) =>
          work(manager),
        ),
      },
    };
    usersService = { findById: jest.fn() };

    service = new OwnershipTransferService(
      seriesRepo as unknown as Repository<SeriesEvent>,
      {} as Repository<CalendarEvent>,
      usersService as unknown as UsersService,
      {
        log: jest.fn().mockResolvedValue(undefined),
        getUserLabel: jest.fn().mockResolvedValue('Admin'),
      } as unknown as AuditLogService,
    );
  });

  const owner = (status: StatusEnum, role: RoleEnum) => ({
    id: 2,
    firstName: 'Neue',
    lastName: 'Person',
    status: { id: status },
    role: { id: role },
  });

  it('should not transfer ownership to inactive users', async () => {
    usersService.findById.mockResolvedValue(
      owner(StatusEnum.inactive, RoleEnum.user),
    );

    await expect(
      service.transfer({ newOwnerId: 2, seriesId: 7 }, { id: 1 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should not transfer ownership to guests', async () => {
    usersService.findById.mockResolvedValue(
      owner(StatusEnum.active, RoleEnum.guest),
    );

    await expect(
      service.transfer({ newOwnerId: 2, seriesId: 7 }, { id: 1 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should report only non-deleted calendar events of a transferred series', async () => {
    usersService.findById.mockResolvedValue(
      owner(StatusEnum.active, RoleEnum.user),
    );

    await expect(
      service.transfer({ newOwnerId: 2, seriesId: 7 }, { id: 1 }),
    ).resolves.toMatchObject({ success: true, affectedCalendarEvents: 3 });
    expect(manager.count).toHaveBeenCalledWith(CalendarEvent, {
      where: { seriesid: 7 },
    });
  });
});
