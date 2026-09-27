import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuditLog1789307426411 implements MigrationInterface {
  name = 'CreateAuditLog1789307426411';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`auditlog\` (\`id\` int NOT NULL AUTO_INCREMENT, \`userId\` int NULL COMMENT 'Ausführender User', \`userLabel\` varchar(255) NULL COMMENT 'Denormalisierter Anzeigename des Users zum Zeitpunkt der Aktion', \`action\` varchar(255) NOT NULL COMMENT 'Art der Aktion', \`entityType\` varchar(255) NOT NULL COMMENT 'Betroffener Entitätstyp, z.B. calendar-event', \`entityId\` varchar(255) NULL COMMENT 'ID der betroffenen Entität (als String)', \`summary\` text NOT NULL COMMENT 'Lesbarer Klartext der Aktion', \`changes\` json NULL COMMENT 'Geänderte Felder bei UPDATE: { feld: { old, new } }', \`ip\` varchar(255) NULL, \`userAgent\` varchar(255) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`IDX_AUDITLOG_ENTITY\` (\`entityType\`, \`entityId\`), INDEX \`IDX_AUDITLOG_CREATED_AT\` (\`createdAt\`), INDEX \`IDX_AUDITLOG_USER\` (\`userId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `ALTER TABLE \`auditlog\` ADD CONSTRAINT \`FK_auditlog_user\` FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`auditlog\` DROP FOREIGN KEY \`FK_auditlog_user\``,
    );
    await queryRunner.query(`DROP TABLE \`auditlog\``);
  }
}
