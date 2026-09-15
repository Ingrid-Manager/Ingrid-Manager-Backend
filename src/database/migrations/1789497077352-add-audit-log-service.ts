import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAuditLogService1789497077352 implements MigrationInterface {
  name = 'AddAuditLogService1789497077352';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`auditlog\` ADD \`service\` varchar(255) NULL COMMENT 'Fachliches Modul, z.B. events, resources, auth'`,
    );

    // Bestehende Einträge anhand von entityType (und bei 'system' zusätzlich
    // action) auf ein Service-Modul zurückführen, damit die Spalte
    // anschließend NOT NULL werden kann, ohne Bestandsdaten zu verlieren.
    await queryRunner.query(`
      UPDATE \`auditlog\`
      SET \`service\` = CASE
        WHEN \`entityType\` IN ('calendar-event', 'series-event') THEN 'events'
        WHEN \`entityType\` IN ('room', 'resource', 'resource-event', 'category') THEN 'resources'
        WHEN \`entityType\` = 'user' THEN 'users'
        WHEN \`entityType\` = 'auth' THEN 'auth'
        WHEN \`entityType\` = 'system' AND \`action\` = 'HOLIDAYS_IMPORTED' THEN 'reorganization'
        ELSE 'system'
      END
    `);

    await queryRunner.query(
      `ALTER TABLE \`auditlog\` CHANGE \`service\` \`service\` varchar(255) NOT NULL COMMENT 'Fachliches Modul, z.B. events, resources, auth'`,
    );

    await queryRunner.query(
      `CREATE INDEX \`IDX_AUDITLOG_SERVICE\` ON \`auditlog\` (\`service\`)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX \`IDX_AUDITLOG_SERVICE\` ON \`auditlog\``);
    await queryRunner.query(`ALTER TABLE \`auditlog\` DROP COLUMN \`service\``);
  }
}
