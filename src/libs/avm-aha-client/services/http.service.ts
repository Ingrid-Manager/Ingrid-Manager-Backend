import axios, { AxiosInstance } from 'axios';
import { Injectable } from '@nestjs/common';

import { AuthService } from './auth.service';
import { AvmConnection } from '../interfaces/avm-connection.interface';

@Injectable()
export class HttpService {
  private readonly client: AxiosInstance;

  constructor(private readonly authService: AuthService) {
    this.client = axios.create({
      timeout: 10000,
    });
  }

  async get(url: string, params?: Record<string, any>) {
    return this.client.get(url, { params });
  }

  async call<T = string>(
    connection: AvmConnection,
    switchcmd: string,
    params: Record<string, any> = {},
  ): Promise<T> {
    const sid = await this.authService.getSid(connection);

    const response = await this.client.get<T>(
      `${connection.url}/webservices/homeautoswitch.lua`,
      {
        params: {
          sid,
          switchcmd,
          ...params,
        },
      },
    );

    return response.data;
  }
}
