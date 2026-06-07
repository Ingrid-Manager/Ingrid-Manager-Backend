import { Test, TestingModule } from '@nestjs/testing';
import { AvmLocationsService } from './avm-locations.service';

describe('AvmLocationsService', () => {
  let service: AvmLocationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AvmLocationsService,
        {
          provide: 'AvmLocationRepository',
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<AvmLocationsService>(AvmLocationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
