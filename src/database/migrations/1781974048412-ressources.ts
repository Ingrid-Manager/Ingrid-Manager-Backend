import { MigrationInterface, QueryRunner } from 'typeorm';

export class Ressources1781974048412 implements MigrationInterface {
  name = 'Ressources1781974048412';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`ressource\` (\`id\` int NOT NULL AUTO_INCREMENT, \`title\` varchar(255) NOT NULL COMMENT 'Bezeichnung der Ressource', \`color\` varchar(255) NOT NULL COMMENT 'Anzeigefarbe im Ressourcenkalender' DEFAULT '#808080', \`manager_email\` varchar(255) NULL COMMENT 'E-Mail Adresse des Verwalters der Ressource', \`inventoryid\` varchar(255) NULL COMMENT 'Inventarnummer der Ressource', PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
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
      `ALTER TABLE \`room\` CHANGE \`avm_id\` \`avm_id\` varchar(255) NULL COMMENT 'AVM Geräte oder Gruppen ID'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`category\` CHANGE \`title\` \`title\` varchar(255) NULL COMMENT 'Bezeichnung der Kategorie'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`calendarevent\` DROP FOREIGN KEY \`FK_ba64df6b4e2420e2ae183c6db09\``,
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
      `ALTER TABLE \`session\` CHANGE \`deletedAt\` \`deletedAt\` datetime(6) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user\` ADD CONSTRAINT \`FK_c28e52f758e7bbc53828db92194\` FOREIGN KEY (\`roleId\`) REFERENCES \`role\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user\` ADD CONSTRAINT \`FK_dc18daa696860586ba4667a9d31\` FOREIGN KEY (\`statusId\`) REFERENCES \`status\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`calendarevent\` ADD CONSTRAINT \`FK_ba64df6b4e2420e2ae183c6db09\` FOREIGN KEY (\`seriesid\`) REFERENCES \`seriesevent\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`calendarevent\` DROP FOREIGN KEY \`FK_ba64df6b4e2420e2ae183c6db09\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`user\` DROP FOREIGN KEY \`FK_dc18daa696860586ba4667a9d31\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`user\` DROP FOREIGN KEY \`FK_c28e52f758e7bbc53828db92194\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`session\` CHANGE \`deletedAt\` \`deletedAt\` datetime(6) NULL DEFAULT 'NULL'`,
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
      `ALTER TABLE \`calendarevent\` ADD CONSTRAINT \`FK_ba64df6b4e2420e2ae183c6db09\` FOREIGN KEY (\`seriesid\`) REFERENCES \`seriesevent\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`category\` CHANGE \`title\` \`title\` varchar(255) NULL COMMENT 'Bezeichnung der Kategorie' DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`room\` CHANGE \`avm_id\` \`avm_id\` varchar(255) NULL COMMENT 'AVM Geräte oder Gruppen ID' DEFAULT 'NULL'`,
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
    await queryRunner.query(`DROP TABLE \`ressource\``);
  }
}
