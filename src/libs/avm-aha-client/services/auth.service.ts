import axios from 'axios';
import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { CacheService } from './cache.service';
import { AvmConnection } from '../interfaces/avm-connection.interface';
import { isPbkdf2Challenge } from '../utils/challenge.util';
import { createPbkdf2Response } from '../utils/pbkdf2.util';
import { createMd5Response } from '../utils/md5.util';

@Injectable()
export class AuthService {
  constructor(private readonly cacheService: CacheService) {}

  async getSid(connection: AvmConnection): Promise<string> {
    const cacheKey = `sid:${connection.url}:${connection.username}`;
    const cached = this.cacheService.get<string>(cacheKey);

    if (cached) {
      return cached;
    }

    const sid = await this.login(connection);

    this.cacheService.set(cacheKey, sid);
    return sid;
  }

  private async login(connection: AvmConnection): Promise<string> {
    const challengeResponse = await axios.get(
      `${connection.url}/login_sid.lua`,
      {
        params: {
          version: 2,
          username: connection.username,
        },
      },
    );

    const challenge = challengeResponse.data.match(
      /<Challenge>(.*?)<\/Challenge>/,
    )?.[1];

    const response = isPbkdf2Challenge(challenge)
      ? createPbkdf2Response(challenge, connection.password)
      : createMd5Response(challenge, connection.password);

    const loginResponse = await axios.get(`${connection.url}/login_sid.lua`, {
      params: {
        username: connection.username,
        response,
        version: 2,
      },
    });

    const sid = loginResponse.data.match(/<SID>(.*?)<\/SID>/)?.[1];

    if (!sid || sid === '0000000000000000') {
      throw new Error(
        `AVM authentication failed for user ${connection.username}`,
      );
    }

    return sid;
  }

  private createResponse(challenge: string, password: string): string {
    const challengePassword = `${challenge}-${password}`;
    const hash = createHash('md5')
      .update(Buffer.from(challengePassword, 'utf16le'))
      .digest('hex');

    return `${challenge}-${hash}`;
  }
}
