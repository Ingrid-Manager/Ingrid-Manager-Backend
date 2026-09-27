import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';

import { AvmLocationsService } from './avm-locations.service';
import { AvmLocation } from './infrastructure/relational/persistence/entities/avm-location.entity';
import { CryptoService } from '../crypto/crypto.service';
import { Room } from '../rooms/infrastructure/relational/persistence/entities/room.entity';

describe('AvmLocationsService', () => {
  let service: AvmLocationsService;
  let repo: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    delete: jest.Mock;
  };
  let roomRepo: { count: jest.Mock };

  beforeEach(async () => {
    repo = {
      create: jest.fn((e) => e),
      save: jest.fn((e) => Promise.resolve({ id: 1, ...e })),
      findOne: jest.fn(),
      delete: jest.fn(),
    };
    roomRepo = { count: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AvmLocationsService,
        {
          provide: getRepositoryToken(AvmLocation),
          useValue: repo,
        },
        {
          provide: getRepositoryToken(Room),
          useValue: roomRepo,
        },
        {
          provide: CryptoService,
          useValue: {
            encrypt: jest.fn((v: string) => `enc:${v}`),
            decrypt: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AvmLocationsService>(AvmLocationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('encrypts the password on create and never returns it', async () => {
    const result = await service.create({
      title: 'Gemeindehaus',
      ahaurl: 'http://fritz.box',
      ahauser: 'admin',
      ahapassword: 'secret',
    });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ ahapassword: 'enc:secret' }),
    );
    expect(result).toEqual({
      id: 1,
      title: 'Gemeindehaus',
      ahaurl: 'http://fritz.box',
      ahauser: 'admin',
    });
  });

  it('keeps the stored password when an empty one is sent on update', async () => {
    repo.findOne.mockResolvedValue({ id: 1, title: 'A', ahapassword: 'old' });

    await service.update({ id: 1, title: 'B', ahapassword: '' });

    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'B', ahapassword: 'old' }),
    );
  });

  it('deletes an unused location', async () => {
    repo.findOne.mockResolvedValue({ id: 1 });
    roomRepo.count.mockResolvedValue(0);

    await service.remove(1);

    expect(roomRepo.count).toHaveBeenCalledWith({
      where: { locationid: 1 },
      withDeleted: true,
    });
    expect(repo.delete).toHaveBeenCalledWith(1);
  });

  it('refuses to delete a location that is still used by rooms', async () => {
    repo.findOne.mockResolvedValue({ id: 1 });
    roomRepo.count.mockResolvedValue(2);

    await expect(service.remove(1)).rejects.toBeInstanceOf(ConflictException);
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('throws NotFound when deleting an unknown location', async () => {
    repo.findOne.mockResolvedValue(null);

    await expect(service.remove(99)).rejects.toBeInstanceOf(NotFoundException);
  });
});
