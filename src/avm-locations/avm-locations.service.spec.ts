import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { AvmLocationsService } from './avm-locations.service';
import { AvmLocation } from './infrastructure/relational/persistence/entities/avm-location.entity';
import { CryptoService } from '../crypto/crypto.service';

describe('AvmLocationsService', () => {
  let service: AvmLocationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AvmLocationsService,
        {
          provide: getRepositoryToken(AvmLocation),
          useValue: {},
        },
        {
          provide: CryptoService,
          useValue: {
            encrypt: jest.fn(),
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
});
