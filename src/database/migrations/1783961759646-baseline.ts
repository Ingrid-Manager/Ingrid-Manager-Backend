import { MigrationInterface, QueryRunner } from 'typeorm';

export class Baseline1783961759646 implements MigrationInterface {
  name = 'Baseline1783961759646';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`user\` DROP FOREIGN KEY \`FK_c28e52f758e7bbc53828db92194\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`user\` DROP FOREIGN KEY \`FK_dc18daa696860586ba4667a9d31\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`user\` CHANGE \`email\` \`email\` varchar(255) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user\` CHANGE \`password\` \`password\` varchar(255) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user\` CHANGE \`socialId\` \`socialId\` varchar(255) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user\` CHANGE \`firstName\` \`firstName\` varchar(255) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user\` CHANGE \`lastName\` \`lastName\` varchar(255) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user\` CHANGE \`userFunction\` \`userFunction\` varchar(255) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user\` CHANGE \`deletedAt\` \`deletedAt\` datetime(6) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user\` CHANGE \`roleId\` \`roleId\` int NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user\` CHANGE \`statusId\` \`statusId\` int NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`session\` CHANGE \`deletedAt\` \`deletedAt\` datetime(6) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`room\` CHANGE \`avm_id\` \`avm_id\` varchar(255) NULL COMMENT 'AVM Geräte oder Gruppen ID'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`room\` CHANGE \`deletedAt\` \`deletedAt\` datetime(6) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`category\` CHANGE \`title\` \`title\` varchar(255) NULL COMMENT 'Bezeichnung der Kategorie'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`calendarevent\` CHANGE \`seriesid\` \`seriesid\` int NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`calendarevent\` CHANGE \`deletedAt\` \`deletedAt\` datetime(6) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`seriesevent\` CHANGE \`description\` \`description\` text NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`seriesevent\` CHANGE \`lastGeneratedUntil\` \`lastGeneratedUntil\` datetime NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`seriesevent\` CHANGE \`lastReorganizationAt\` \`lastReorganizationAt\` datetime NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`resource\` CHANGE \`manager_email\` \`manager_email\` varchar(255) NULL COMMENT 'E-Mail Adresse des Verwalters der Resource'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`resource\` CHANGE \`inventoryid\` \`inventoryid\` varchar(255) NULL COMMENT 'Inventarnummer der Resource'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`resourceevent\` CHANGE \`deletedAt\` \`deletedAt\` datetime(6) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`heating_log\` CHANGE \`appointmentid\` \`appointmentid\` int NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`heating_log\` DROP COLUMN \`context\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`heating_log\` ADD \`context\` json NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`heating_log\` CHANGE \`message\` \`message\` text NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`heating_state\` CHANGE \`appointmentid\` \`appointmentid\` int NULL COMMENT 'Aktiver Kalendereintrag'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`heating_state\` CHANGE \`lastExecution\` \`lastExecution\` datetime NULL COMMENT 'Zeitpunkt der letzten erfolgreichen AVM-Kommunikation'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user\` ADD CONSTRAINT \`FK_c28e52f758e7bbc53828db92194\` FOREIGN KEY (\`roleId\`) REFERENCES \`role\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user\` ADD CONSTRAINT \`FK_dc18daa696860586ba4667a9d31\` FOREIGN KEY (\`statusId\`) REFERENCES \`status\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await this.addForeignKeyIfNotExists(
      queryRunner,
      'room',
      'FK_f40ce90b5ffbc4b2e855b789dab',
      'ALTER TABLE `room` ADD CONSTRAINT `FK_f40ce90b5ffbc4b2e855b789dab` FOREIGN KEY (`createdbyid`) REFERENCES `user`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION',
    );
    await this.addForeignKeyIfNotExists(
      queryRunner,
      'calendarevent',
      'FK_ba64df6b4e2420e2ae183c6db09',
      'ALTER TABLE `calendarevent` ADD CONSTRAINT `FK_ba64df6b4e2420e2ae183c6db09` FOREIGN KEY (`seriesid`) REFERENCES `seriesevent`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION',
    );
  }

  /**
   * Einige Umgebungen haben diese Fremdschlüssel bereits über eine ältere,
   * nie eingecheckte Baseline-Migration direkt auf dem Server erhalten
   * (siehe Baseline1784057005412, die nicht im Repo existiert). Damit diese
   * Migration dort nicht mit "Duplicate foreign key constraint name"
   * fehlschlägt, aber auf frischen Datenbanken trotzdem den Fremdschlüssel
   * anlegt, wird der Ist-Zustand vorher geprüft.
   */
  private async addForeignKeyIfNotExists(
    queryRunner: QueryRunner,
    tableName: string,
    constraintName: string,
    sql: string,
  ): Promise<void> {
    const table = await queryRunner.getTable(tableName);
    const exists = table?.foreignKeys.some((fk) => fk.name === constraintName);
    if (!exists) {
      await queryRunner.query(sql);
    }
  }

  private async dropForeignKeyIfExists(
    queryRunner: QueryRunner,
    tableName: string,
    constraintName: string,
  ): Promise<void> {
    const table = await queryRunner.getTable(tableName);
    const foreignKey = table?.foreignKeys.find(
      (fk) => fk.name === constraintName,
    );
    if (foreignKey) {
      await queryRunner.query(
        `ALTER TABLE \`${tableName}\` DROP FOREIGN KEY \`${constraintName}\``,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.dropForeignKeyIfExists(
      queryRunner,
      'calendarevent',
      'FK_ba64df6b4e2420e2ae183c6db09',
    );
    await this.dropForeignKeyIfExists(
      queryRunner,
      'room',
      'FK_f40ce90b5ffbc4b2e855b789dab',
    );
    await queryRunner.query(
      `ALTER TABLE \`user\` DROP FOREIGN KEY \`FK_dc18daa696860586ba4667a9d31\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`user\` DROP FOREIGN KEY \`FK_c28e52f758e7bbc53828db92194\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`heating_state\` CHANGE \`lastExecution\` \`lastExecution\` datetime NULL COMMENT 'Zeitpunkt der letzten erfolgreichen AVM-Kommunikation' DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`heating_state\` CHANGE \`appointmentid\` \`appointmentid\` int NULL COMMENT 'Aktiver Kalendereintrag' DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`heating_log\` CHANGE \`message\` \`message\` text NULL DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`heating_log\` DROP COLUMN \`context\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`heating_log\` ADD \`context\` longtext COLLATE "utf8mb4_bin" NULL DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`heating_log\` CHANGE \`appointmentid\` \`appointmentid\` int NULL DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`resourceevent\` CHANGE \`deletedAt\` \`deletedAt\` datetime(6) NULL DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`resource\` CHANGE \`inventoryid\` \`inventoryid\` varchar(255) NULL COMMENT 'Inventarnummer der Resource' DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`resource\` CHANGE \`manager_email\` \`manager_email\` varchar(255) NULL COMMENT 'E-Mail Adresse des Verwalters der Resource' DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`seriesevent\` CHANGE \`lastReorganizationAt\` \`lastReorganizationAt\` datetime NULL DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`seriesevent\` CHANGE \`lastGeneratedUntil\` \`lastGeneratedUntil\` datetime NULL DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`seriesevent\` CHANGE \`description\` \`description\` text NULL DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`calendarevent\` CHANGE \`deletedAt\` \`deletedAt\` datetime(6) NULL DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`calendarevent\` CHANGE \`seriesid\` \`seriesid\` int NULL DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`category\` CHANGE \`title\` \`title\` varchar(255) NULL COMMENT 'Bezeichnung der Kategorie' DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`room\` CHANGE \`deletedAt\` \`deletedAt\` datetime(6) NULL DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`room\` CHANGE \`avm_id\` \`avm_id\` varchar(255) NULL COMMENT 'AVM Geräte oder Gruppen ID' DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`session\` CHANGE \`deletedAt\` \`deletedAt\` datetime(6) NULL DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user\` CHANGE \`statusId\` \`statusId\` int NULL DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user\` CHANGE \`roleId\` \`roleId\` int NULL DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user\` CHANGE \`deletedAt\` \`deletedAt\` datetime(6) NULL DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user\` CHANGE \`userFunction\` \`userFunction\` varchar(255) NULL DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user\` CHANGE \`lastName\` \`lastName\` varchar(255) NULL DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user\` CHANGE \`firstName\` \`firstName\` varchar(255) NULL DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user\` CHANGE \`socialId\` \`socialId\` varchar(255) NULL DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user\` CHANGE \`password\` \`password\` varchar(255) NULL DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user\` CHANGE \`email\` \`email\` varchar(255) NULL DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user\` ADD CONSTRAINT \`FK_dc18daa696860586ba4667a9d31\` FOREIGN KEY (\`statusId\`) REFERENCES \`status\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user\` ADD CONSTRAINT \`FK_c28e52f758e7bbc53828db92194\` FOREIGN KEY (\`roleId\`) REFERENCES \`role\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }
}
