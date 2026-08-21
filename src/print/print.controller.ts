import { Body, Controller, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import { RolesGuard } from '../roles/roles.guard';
import { PrintService } from './print.service';
import { PrintCalendarDto } from './dto/print-calendar.dto';

/**
 * Eigener Controller (statt einer Methode im CalendarEventsController),
 * damit die Druckfunktion als eigenständiges Feature-Modul (src/print/)
 * organisiert ist — analog zu anderen Cross-Cutting-Concerns in diesem
 * Projekt (vgl. src/mail vs. src/mailer). Der Pfad bleibt bewusst unter
 * "calendar-events", da inhaltlich Kalendertermine gedruckt werden
 * (REST-Konvention: Sub-Ressource der eigentlichen Ressource); NestJS
 * erlaubt es problemlos, dass mehrere Controller in unterschiedlichen
 * Modulen zum selben Basis-Pfad beitragen.
 */
@Roles(RoleEnum.admin, RoleEnum.verwaltung, RoleEnum.user, RoleEnum.guest)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({
  path: 'calendar-events',
  version: '1',
})
export class PrintController {
  constructor(private readonly printService: PrintService) {}

  /**
   * Erzeugt ein PDF (Woche/Monat/Jahr) aus den echten Termindaten und
   * liefert es direkt als Binärdatei zurück (kein Zwischenspeichern nötig).
   */
  @Post('print')
  async printCalendar(
    @Body() dto: PrintCalendarDto,
    @Res() res: Response,
  ): Promise<void> {
    const pdf = await this.printService.generateCalendarPdf(dto);

    // Defense-in-depth für den Dateinamen im Content-Disposition-Header:
    // dto.date/dto.type sind zwar bereits über class-validator strikt
    // validiert (@IsDateString / @IsEnum) und damit schon jetzt frei von
    // Zeichen, die eine Header-Injection ermöglichen würden — falls diese
    // Validierung aber jemals gelockert wird, verhindert dieser zusätzliche
    // Filter, dass ungewöhnliche Zeichen ungeprüft in den HTTP-Header
    // gelangen.
    const safeFilenamePart = (value: string) =>
      value.replace(/[^a-zA-Z0-9_-]/g, '_');

    const filename = `kalender-${safeFilenamePart(dto.type)}-${safeFilenamePart(dto.date)}.pdf`;

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdf.length.toString(),
    });

    res.end(pdf);
  }
}
