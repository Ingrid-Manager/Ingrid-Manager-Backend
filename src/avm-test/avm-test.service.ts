import { Injectable } from '@nestjs/common';
import { AvmAhaClientService } from '../libs/avm-aha-client';

@Injectable()
export class AvmTestService {
  constructor(private readonly avmClient: AvmAhaClientService) {}

  private getConnection() {
    return {
      url: process.env.AVM_URL!,
      username: process.env.AVM_USER!,
      password: process.env.AVM_PASSWORD!,
    };
  }

  ping() {
    return this.avmClient.healthCheck(this.getConnection());
  }

  devices() {
    return this.avmClient.getDevices(this.getConnection());
  }

  thermostats() {
    return this.avmClient.findThermostats(this.getConnection());
  }
}
