import { DynamicModule, Module } from '@nestjs/common';

import { AVM_AHA_OPTIONS } from './avm-aha-client.constants';
import { AvmAhaClientOptions } from './avm-aha-client.options';

import { CacheService } from './services/cache.service';
import { AuthService } from './services/auth.service';
import { DeviceService } from './services/device.service';
import { ThermostatService } from './services/thermostat.service';
import { HealthService } from './services/health.service';

import { AvmAhaClientService } from './avm-aha-client.service';
import { HttpService } from './services/http.service';
import { DiscoveryService } from './services/discovery.service';

@Module({})
export class AvmAhaClientModule {
  static forRoot(options: AvmAhaClientOptions = {}): DynamicModule {
    return {
      module: AvmAhaClientModule,
      providers: [
        {
          provide: AVM_AHA_OPTIONS,
          useValue: options,
        },
        CacheService,
        HttpService,
        AuthService,
        DeviceService,
        ThermostatService,
        HealthService,
        AvmAhaClientService,
        DiscoveryService,
      ],
      exports: [AvmAhaClientService],
    };
  }
}
