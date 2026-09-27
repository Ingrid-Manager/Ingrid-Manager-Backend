import {
  Controller,
  Get,
  Headers,
  NotFoundException,
  Param,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual, createHash } from 'node:crypto';
import { PrintHtmlCacheService } from './print-html-cache.service';
import { AllConfigType } from '../config/config.type';

/**
 * Konstantzeit-Vergleich zweier Strings über Hashing auf feste Länge +
 * crypto.timingSafeEqual. Ein normaler `===`/`!==`-Vergleich von Strings
 * bricht bei der ersten abweichenden Stelle ab — das erzeugt einen
 * (praktisch sehr kleinen, aber prinzipiell messbaren) Zeitunterschied,
 * über den ein Angreifer ein Secret theoretisch Zeichen für Zeichen
 * erraten könnte. Das Hashing auf feste Länge vermeidet zusätzlich, dass
 * die reine Länge der Eingabe (vor dem Hashing) irgendeine Information
 * preisgibt.
 */
function constantTimeEquals(a: string, b: string): boolean {
  const hashA = createHash('sha256').update(a).digest();
  const hashB = createHash('sha256').update(b).digest();
  return timingSafeEqual(hashA, hashB);
}

/**
 * Bewusst OHNE AuthGuard/RolesGuard: Diese Route wird nicht von
 * eingeloggten Nutzer:innen im Browser aufgerufen, sondern vom externen
 * PDF-Render-Server (der hat kein JWT unserer App). Stattdessen doppelt
 * abgesichert:
 *
 * 1. Der Token in der URL ist kryptografisch zufällig, einmalig nutzbar
 *    und läuft nach kurzer Zeit ab (siehe PrintHtmlCacheService) —
 *    nicht erratbar, nach dem ersten Abruf sofort ungültig.
 * 2. Der "X-App-Key"-Header muss mit PDF_SERVICE_APP_KEY übereinstimmen
 *    — demselben Secret, das der PDF-Server für seine Rückrufe nutzt.
 *    Nur wer beide Geheimnisse kennt, bekommt Zugriff.
 */
@Controller({ path: 'print-html', version: '1' })
export class PrintHtmlController {
  constructor(
    private readonly cache: PrintHtmlCacheService,
    private readonly configService: ConfigService<AllConfigType>,
  ) {}

  @Get(':token')
  get(
    @Param('token') token: string,
    @Headers('x-app-key') appKey: string | undefined,
    @Res() res: Response,
  ): void {
    const expectedKey = this.configService.get<string>('app.pdfServiceAppKey', {
      infer: true,
    });

    if (!expectedKey || !appKey || !constantTimeEquals(appKey, expectedKey)) {
      throw new UnauthorizedException('Ungültiger oder fehlender App-Key.');
    }

    const html = this.cache.consume(token);

    if (!html) {
      throw new NotFoundException(
        'Token ungültig, abgelaufen oder bereits verwendet.',
      );
    }

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }
}
