import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

/*
 * AIN eines FRITZ!DECT-Geräts oder einer Gruppe, z. B. "09995 0179707",
 * "11657 0240192-1" oder "grp303E4F-3F7D9BE07".
 */
const AIN_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 :_-]{0,39}$/;

@Injectable()
export class ParseAinPipe implements PipeTransform<unknown, string> {
  transform(value: unknown): string {
    const ain = typeof value === 'string' ? value.trim() : '';

    if (!AIN_PATTERN.test(ain)) {
      throw new BadRequestException('Ungültige AIN');
    }

    return ain;
  }
}
