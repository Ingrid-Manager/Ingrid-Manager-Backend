/*
 * ISO-8601-Kalenderwoche samt zugehörigem Wochenjahr. Das Wochenjahr kann
 * vom Kalenderjahr abweichen: Mo 29.12.2025 liegt z. B. in KW 1 des Jahres
 * 2026, Fr 01.01.2027 in KW 53 des Jahres 2026.
 */
export function getIsoWeek(date: Date): { week: number; year: number } {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayNum = d.getUTCDay() || 7;
  // Donnerstag derselben Woche bestimmt Woche und Wochenjahr
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const year = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );

  return { week, year };
}
