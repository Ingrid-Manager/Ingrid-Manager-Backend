import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

import {
  EXAMPLE_LOCATION_TITLE,
  HOLIDAY_CATEGORY_TITLE,
  HOLIDAY_ROOM_TITLE,
  HolidaySeedService,
} from './holiday-seed.service';
import { AvmLocation } from '../../../../avm-locations/infrastructure/relational/persistence/entities/avm-location.entity';
import { Category } from '../../../../categories/infrastructure/relational/persistence/entities/category.entity';
import { Room } from '../../../../rooms/infrastructure/relational/persistence/entities/room.entity';
import { UserEntity } from '../../../../users/infrastructure/persistence/relational/entities/user.entity';
import { RoleEnum } from '../../../../roles/roles.enum';

describe('HolidaySeedService', () => {
  let service: HolidaySeedService;
  let config: Record<string, number | undefined>;
  let categoryRepository: {
    count: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let roomRepository: { count: jest.Mock; create: jest.Mock; save: jest.Mock };
  let locationRepository: {
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let userRepository: { findOne: jest.Mock };

  beforeEach(async () => {
    config = {};
    categoryRepository = {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn((data) => data),
      save: jest.fn((data) => Promise.resolve(data)),
    };
    roomRepository = {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn((data) => data),
      save: jest.fn((data) => Promise.resolve(data)),
    };
    locationRepository = {
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((data) => data),
      save: jest.fn((data) => Promise.resolve({ id: 1, ...data })),
    };
    userRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 7 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HolidaySeedService,
        {
          provide: getRepositoryToken(Category),
          useValue: categoryRepository,
        },
        { provide: getRepositoryToken(Room), useValue: roomRepository },
        {
          provide: getRepositoryToken(AvmLocation),
          useValue: locationRepository,
        },
        { provide: getRepositoryToken(UserEntity), useValue: userRepository },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((key: string) => config[key]) },
        },
      ],
    }).compile();

    service = module.get(HolidaySeedService);
  });

  it('should create the holiday category, an example location and the holiday room', async () => {
    await service.run();

    expect(categoryRepository.save).toHaveBeenCalledWith({
      id: 9999,
      title: HOLIDAY_CATEGORY_TITLE,
    });
    expect(locationRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        title: EXAMPLE_LOCATION_TITLE,
        ahauser: '',
        ahapassword: '',
      }),
    );
    expect(userRepository.findOne).toHaveBeenCalledWith({
      where: { role: { id: RoleEnum.admin } },
      order: { id: 'ASC' },
    });
    expect(roomRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 9999,
        title: HOLIDAY_ROOM_TITLE,
        avm_id: null,
        heated: false,
        hidden: true,
        locationid: 1,
        createdbyid: 7,
      }),
    );
  });

  it('should use the configured holiday ids', async () => {
    config['app.holidayCategoryId'] = 12;
    config['app.holidayRoomId'] = 34;

    await service.run();

    expect(categoryRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 12 }),
    );
    expect(roomRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 34 }),
    );
  });

  it('should assign the holiday room to the first existing location instead of creating an example location', async () => {
    locationRepository.find.mockResolvedValue([
      { id: 3, title: 'Gemeindehaus' },
    ]);

    await service.run();

    expect(locationRepository.save).not.toHaveBeenCalled();
    expect(roomRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ locationid: 3 }),
    );
  });

  it('should not change existing records', async () => {
    locationRepository.find.mockResolvedValue([{ id: 3 }]);
    categoryRepository.count.mockResolvedValue(1);
    roomRepository.count.mockResolvedValue(1);

    await service.run();

    expect(roomRepository.count).toHaveBeenCalledWith({
      where: { id: 9999 },
      withDeleted: true,
    });
    expect(categoryRepository.save).not.toHaveBeenCalled();
    expect(locationRepository.save).not.toHaveBeenCalled();
    expect(roomRepository.save).not.toHaveBeenCalled();
  });

  it('should fall back to the first user when there is no admin', async () => {
    userRepository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 2 });

    await service.run();

    expect(roomRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ createdbyid: 2 }),
    );
  });

  it('should skip the holiday room when there is no user', async () => {
    userRepository.findOne.mockResolvedValue(null);

    await service.run();

    expect(roomRepository.save).not.toHaveBeenCalled();
    expect(categoryRepository.save).toHaveBeenCalled();
  });
});
