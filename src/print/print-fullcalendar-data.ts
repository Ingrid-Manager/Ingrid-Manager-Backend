import { CalendarEventResponseDto } from '../calendar-events/application/dto/calendar-event-response.dto';

export interface PrintRoom {
  id: number;
  title: string;
  color: string;
}

/**
 * Sicheres JSON.stringify für die Einbettung in ein <script>-Tag:
 * verhindert, dass ein `</script>` im Titel eines Termins das
 * umgebende <script>-Element vorzeitig schließt (Injection-Schutz).
 */
export function toSafeInlineJson(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

function formatTimeLabel(date: Date): string {
  return date.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toDateOnlyIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Formatiert ein Datum als "naiven" lokalen Zeitstempel OHNE Zeitzonen-
 * Suffix (kein "Z", kein Offset), z. B. "2026-06-15T09:00:00".
 *
 * Warum das wichtig ist: `event.start`/`event.end` sind zur Laufzeit
 * echte `Date`-Objekte (der Service wird hier direkt im Prozess
 * aufgerufen, nicht über HTTP/JSON). Würde man sie unverändert in ein
 * Objekt packen, das später mit JSON.stringify serialisiert wird, ruft
 * JS automatisch `.toISOString()` auf — das erzeugt einen
 * UTC-Zeitstempel mit "Z"-Suffix. FullCalendar (im Chromium-Tab)
 * würde diesen dann in DESSEN Systemzeitzone interpretieren, nicht in
 * der Zeitzone der Kirchengemeinde. Läuft der Server in UTC, während
 * die Gemeinde z. B. in Europe/Berlin liegt, würden Termine dadurch um
 * 1–2 Stunden verschoben angezeigt.
 * Ein zeitzonenloser String wird von FullCalendar als "lokale"
 * Wanduhrzeit interpretiert und exakt so dargestellt, wie sie am
 * Server (in dessen konfigurierter Zeitzone) berechnet wurde.
 */
function toLocalDateTimeIso(date: Date): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${toDateOnlyIso(date)}T${hh}:${mm}:${ss}`;
}

/**
 * Wochenansicht (print-week.hbs): FullCalendar timeGridWeek erwartet
 * echte Start-/End-Zeitpunkte; Raumfarbe wird pro Termin über
 * extendedProps.roomColor mitgegeben und im Template per
 * eventDidMount-Hook auf das DOM-Element angewendet (statt fixer
 * ev-room1..5-CSS-Klassen, da eine beliebige Anzahl echter Räume mit
 * beliebigen Farben unterstützt werden muss).
 */
export function buildWeekEvents(
  events: CalendarEventResponseDto[],
): Record<string, unknown>[] {
  return events.map((event) => ({
    title: event.title,
    // new Date(...) statt event.start direkt: macht die Funktion robust,
    // egal ob zur Laufzeit ein Date-Objekt oder (z. B. über einen
    // künftigen HTTP-Zwischenschritt) ein ISO-String ankommt.
    start: toLocalDateTimeIso(new Date(event.start)),
    end: toLocalDateTimeIso(new Date(event.end)),
    allDay: !!event.allDay,
    extendedProps: {
      roomColor: event.color ?? '#999999',
      roomTitle: event.room_title,
    },
  }));
}

/**
 * Monatsansicht (print-month.hbs): Die Vorlage blendet die
 * FullCalendar-eigene Zeitanzeige aus (`.fc-event-time { display:none }`)
 * und erwartet die Uhrzeit stattdessen als Teil des Titeltexts
 * ("17:00 Konfi-Unterricht"), sowie ein reines Datum (ohne Uhrzeit)
 * als `start`, damit FullCalendar den Termin als einfachen
 * Tagesblock ohne Zeitlogik behandelt.
 */
export function buildMonthEvents(
  events: CalendarEventResponseDto[],
): Record<string, unknown>[] {
  return events.map((event) => {
    const start = new Date(event.start);
    const titlePrefix = event.allDay ? '' : `${formatTimeLabel(start)} `;

    return {
      title: `${titlePrefix}${event.title}`,
      start: toDateOnlyIso(start),
      extendedProps: {
        roomColor: event.color ?? '#999999',
        roomTitle: event.room_title,
      },
    };
  });
}

/**
 * Maximale Anzahl Tage, für die ein einzelner Termin in der
 * Jahresansicht eingetragen wird. Schützt vor einer Endlosschleife
 * bzw. exzessiv langer Laufzeit, falls ein Termin (z. B. durch einen
 * Dateneingabefehler) ein extrem weit in der Zukunft liegendes
 * Enddatum hat — ohne diese Grenze würde die Schleife unten pro Tag
 * zwischen Start und Ende iterieren, im Extremfall Millionen Mal.
 */
const MAX_EVENT_SPAN_DAYS = 400;

/**
 * Jahresansicht (print-year.hbs): eigenständiges Vanilla-JS-Raster
 * (kein FullCalendar). Erwartet `{ date: 'YYYY-MM-DD', title, roomColor }`.
 * Mehrtägige Termine werden an jedem betroffenen Kalendertag eingetragen.
 */
export function buildYearEvents(
  events: CalendarEventResponseDto[],
): Record<string, unknown>[] {
  const result: Record<string, unknown>[] = [];

  for (const event of events) {
    const start = new Date(event.start);
    const end = new Date(event.end);
    const titlePrefix = event.allDay ? '' : `${formatTimeLabel(start)} `;
    const title = `${titlePrefix}${event.title}`;

    const cursor = new Date(start);
    cursor.setHours(0, 0, 0, 0);

    const boundary = new Date(end);
    if (
      !event.allDay &&
      boundary.getHours() === 0 &&
      boundary.getMinutes() === 0
    ) {
      boundary.setDate(boundary.getDate() - 1);
    }

    // Sicherheitsnetz: niemals mehr als MAX_EVENT_SPAN_DAYS Tage für
    // einen einzelnen Termin eintragen (siehe Kommentar oben).
    const cappedBoundary = new Date(cursor);
    cappedBoundary.setDate(cappedBoundary.getDate() + MAX_EVENT_SPAN_DAYS);
    const effectiveBoundary =
      boundary.getTime() < cappedBoundary.getTime() ? boundary : cappedBoundary;

    while (cursor <= effectiveBoundary) {
      result.push({
        date: toDateOnlyIso(cursor),
        title,
        roomColor: event.color ?? '#999999',
      });
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return result;
}
