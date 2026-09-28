import { MigrationInterface, QueryRunner } from 'typeorm';

/*
 * Indizes für häufige Abfragen, die bisher ohne passenden Index liefen:
 * - seriesevent.roomid / createdbyid (Raumbezug, Eigentümerwechsel; die
 *   Spalten haben keinen Fremdschlüssel und damit auch keinen impliziten
 *   Index)
 * - calendarevent (isBackground, deletedAt, end) für die minütliche
 *   Abfrage der Heizungssteuerung
 * Idempotent: bereits vorhandene Indizes werden übersprungen.
 */
const INDEXES: Array<{ table: string; name: string; columns: string[] }> = [
  { table: 'seriesevent', name: 'IDX_SERIES_EVENT_ROOM', columns: ['roomid'] },
  {
    table: 'seriesevent',
    name: 'IDX_SERIES_EVENT_CREATED_BY',
    columns: ['createdbyid'],
  },
  {
    table: 'calendarevent',
    name: 'IDX_CALENDAR_EVENT_HEATING',
    columns: ['isBackground', 'deletedAt', 'end'],
  },
];

async function indexExists(
  queryRunner: QueryRunner,
  table: string,
  index: string,
): Promise<boolean> {
  const rows: Array<{ count: number | string }> = await queryRunner.query(
    'SELECT COUNT(*) AS `count` FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?',
    [table, index],
  );

  return Number(rows[0]?.count ?? 0) > 0;
}

export class AddEventLookupIndexes1790600000001 implements MigrationInterface {
  name = 'AddEventLookupIndexes1790600000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const { table, name, columns } of INDEXES) {
      if (await indexExists(queryRunner, table, name)) {
        continue;
      }

      await queryRunner.query(
        `CREATE INDEX \`${name}\` ON \`${table}\` (${columns
          .map((column) => `\`${column}\``)
          .join(', ')})`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const { table, name } of INDEXES) {
      if (await indexExists(queryRunner, table, name)) {
        await queryRunner.query(`DROP INDEX \`${name}\` ON \`${table}\``);
      }
    }
  }
}
