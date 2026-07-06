import { Injectable } from '@nestjs/common';

import { AvmConnection } from '../interfaces/avm-connection.interface';
import { HttpService } from './http.service';
import { AuthService } from './auth.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly httpService: HttpService,
    private readonly authService: AuthService,
  ) {}

  async ping(connection: AvmConnection): Promise<boolean> {
    try {
      await this.httpService.get(`${connection.url}/login_sid.lua`);
      return true;
    } catch {
      return false;
    }
  }

  async validateCredentials(connection: AvmConnection): Promise<boolean> {
    try {
      await this.authService.getSid(connection);
      return true;
    } catch {
      return false;
    }
  }
}
