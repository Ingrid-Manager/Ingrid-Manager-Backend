import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { AvmLocationsService } from './avm-locations.service';
import { AvmLocation } from './infrastructure/relational/persistence/entities/avm-location.entity';
import { CryptoService } from '../crypto/crypto.service';

describe('AvmLocationsService', () => {
  let service: AvmLocationsService;
  let repo: { findOne: jest.Mock; update: jest.Mock };
  let cryptoService: {
    encrypt: jest.Mock;
    decrypt: jest.Mock;
    decryptWithMetadata: jest.Mock;
  };

  beforeEach(async () => {
    repo = {
      findOne: jest.fn().mockResolvedValue({
        id: 4,
        title: 'Gemeindehaus',
        ahaurl: 'http://192.168.178.1',
        ahauser: 'admin',
        ahapassword: 'legacy-iv:legacy-ciphertext',
      }),
      update: jest.fn().mockResolvedValue(undefined),
    };
    cryptoService = {
      encrypt: jest.fn(() => 'v1:new'),
      decrypt: jest.fn(),
      decryptWithMetadata: jest.fn(() => ({
        value: 'klartext',
        needsReEncryption: false,
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AvmLocationsService,
        {
          provide: getRepositoryToken(AvmLocation),
          useValue: repo,
        },
        {
          provide: CryptoService,
          useValue: cryptoService,
        },
      ],
    }).compile();

    service = module.get<AvmLocationsService>(AvmLocationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should re-encrypt passwords stored in a legacy format when reading them', async () => {
    cryptoService.decryptWithMetadata.mockReturnValue({
      value: 'klartext',
      needsReEncryption: true,
    });

    const connection = await service.getConnection(4);

    expect(connection.password).toBe('klartext');
    expect(repo.update).toHaveBeenCalledWith(
      { id: 4 },
      { ahapassword: 'v1:new' },
    );
  });

  it('should not rewrite passwords that are already current', async () => {
    await service.getConnection(4);

    expect(repo.update).not.toHaveBeenCalled();
  });

  it('should still connect when the re-encryption cannot be saved', async () => {
    cryptoService.decryptWithMetadata.mockReturnValue({
      value: 'klartext',
      needsReEncryption: true,
    });
    repo.update.mockRejectedValue(new Error('db down'));

    await expect(service.getConnection(4)).resolves.toMatchObject({
      password: 'klartext',
    });
  });
});
