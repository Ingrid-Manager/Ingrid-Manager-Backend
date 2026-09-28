import { MigrationInterface, QueryRunner } from 'typeorm';

/*
 * Zusammengesetzte Indizes für die Abfragen des Aktivitätsprotokolls
 * (Filter + Sortierung nach createdAt DESC mit Paging). Idempotent: bereits
 * vorhandene Indizes werden übersprungen.
 */
const INDEXES: Array<{ name: string; columns: string[] }> = [
  {
    name: 'IDX_AUDITLOG_SERVICE_CREATED_AT',
    columns: ['service', 'createdAt'],
  },
  { name: 'IDX_AUDITLOG_USER_CREATED_AT', columns: ['userId', 'createdAt'] },
  {
    name: 'IDX_AUDITLOG_ENTITY_CREATED_AT',
    columns: ['entityType', 'entityId', 'createdAt'],
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

export class AddAuditLogCompositeIndexes1790600000000 implements MigrationInterface {
  name = 'AddAuditLogCompositeIndexes1790600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const { name, columns } of INDEXES) {
      if (await indexExists(queryRunner, 'auditlog', name)) {
        continue;
      }

      await queryRunner.query(
        `CREATE INDEX \`${name}\` ON \`auditlog\` (${columns
          .map((column) => `\`${column}\``)
          .join(', ')})`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const { name } of INDEXES) {
      if (await indexExists(queryRunner, 'auditlog', name)) {
        await queryRunner.query(`DROP INDEX \`${name}\` ON \`auditlog\``);
      }
    }
  }
}
