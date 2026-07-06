import { Controller, Get } from '@nestjs/common';
import { AvmTestService } from './avm-test.service';

@Controller('avm-test')
export class AvmTestController {
  constructor(private readonly service: AvmTestService) {}

  @Get('ping')
  ping() {
    return this.service.ping();
  }

  @Get('devices')
  devices() {
    return this.service.devices();
  }

  @Get('thermostats')
  thermostats() {
    return this.service.thermostats();
  }
}
