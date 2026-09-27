/*
 * Jahresunabhängige, wiederkehrende Heizsaison (HEATING_SEASON_START /
 * HEATING_SEASON_END im Format MM-DD). Beide Grenzen sind inklusive.
 *
 * Die Auswertung erfolgt - wie die übrige Kalenderlogik des Backends
 * (z. B. CalendarEventsService.getHeatingEvents) - in der lokalen Zeitzone
 * des Backend-Prozesses.
 */
export interface MonthDay {
  month: number;
  day: number;
}

export interface HeatingSeason {
  start: MonthDay;
  end: MonthDay;
}

// Schaltjahr als Referenz, damit 02-29 als gültige Grenze akzeptiert wird.
const DAYS_PER_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function parseMonthDay(
  value: string | undefined | null,
): MonthDay | null {
  const match = /^(\d{2})-(\d{2})$/.exec((value ?? '').trim());

  if (!match) {
    return null;
  }

  const month = Number(match[1]);
  const day = Number(match[2]);

  if (month < 1 || month > 12 || day < 1 || day > DAYS_PER_MONTH[month - 1]) {
    return null;
  }

  return { month, day };
}

export function parseHeatingSeason(
  start: string | undefined | null,
  end: string | undefined | null,
): HeatingSeason | null {
  const parsedStart = parseMonthDay(start);
  const parsedEnd = parseMonthDay(end);

  if (!parsedStart || !parsedEnd) {
    return null;
  }

  return { start: parsedStart, end: parsedEnd };
}

function toOrdinal(value: MonthDay): number {
  return value.month * 100 + value.day;
}

/*
 * IN_SEASON(now). Unterstützt auch Saisons über den Jahreswechsel
 * (z. B. 10-01 bis 04-30).
 */
export function isInSeason(now: Date, season: HeatingSeason): boolean {
  const today = toOrdinal({ month: now.getMonth() + 1, day: now.getDate() });
  const start = toOrdinal(season.start);
  const end = toOrdinal(season.end);

  if (start <= end) {
    return today >= start && today <= end;
  }

  return today >= start || today <= end;
}
