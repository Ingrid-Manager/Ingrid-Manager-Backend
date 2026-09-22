import { MigrationInterface, QueryRunner } from 'typeorm';

export class NormalizeSeriesEventWeekdays1790062585748
  implements MigrationInterface
{
  name = 'NormalizeSeriesEventWeekdays1790062585748';

  // `seriesevent.weekdays` wurde teils in ISO-Konvention (1=Montag...7=Sonntag)
  // befüllt, während Date.getDay() und der Client 0=Sonntag verwenden. Ein
  // gespeichertes `7` würde dadurch von SeriesGeneratorService nie mehr als
  // Sonntag erkannt und stillschweigend keine Termine mehr erzeugen. Bestehende
  // Datensätze werden hier einmalig auf die einheitliche JS-Konvention (0-6)
  // umgestellt.
  public async up(queryRunner: QueryRunner): Promise<void> {
    const rows: { id: number; weekdays: string }[] = await queryRunner.query(
      'SELECT `id`, `weekdays` FROM `seriesevent`',
    );

    for (const row of rows) {
      let weekdays: unknown;

      try {
        weekdays = JSON.parse(row.weekdays);
      } catch {
        continue;
      }

      if (!Array.isArray(weekdays) || !weekdays.includes(7)) {
        continue;
      }

      const normalized = [
        ...new Set(weekdays.map((d) => (d === 7 ? 0 : d))),
      ];

      await queryRunner.query(
        'UPDATE `seriesevent` SET `weekdays` = ? WHERE `id` = ?',
        [JSON.stringify(normalized), row.id],
      );
    }
  }

  public async down(): Promise<void> {
    // Nicht umkehrbar: ob eine gespeicherte 0 ursprünglich 0 oder 7 war,
    // lässt sich nachträglich nicht mehr feststellen.
  }
}
