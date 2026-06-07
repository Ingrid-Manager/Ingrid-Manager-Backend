import { Test, TestingModule } from '@nestjs/testing';
import { AvmLocationsController } from './avm-locations.controller';
import { AvmLocationsService } from './avm-locations.service';

describe('AvmLocationsController', () => {
  let controller: AvmLocationsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AvmLocationsController],
      providers: [
        {
          provide: AvmLocationsService,
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get<AvmLocationsController>(AvmLocationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
