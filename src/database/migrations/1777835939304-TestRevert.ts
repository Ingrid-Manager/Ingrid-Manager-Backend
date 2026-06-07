import { MigrationInterface, QueryRunner } from 'typeorm';

export class TestRevert1777835939304 implements MigrationInterface {
  name = 'TestRevert1777835939304';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`avmlocation\` DROP COLUMN \`testtom\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`user\` DROP FOREIGN KEY \`FK_75e2be4ce11d447ef43be0e374f\``,
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
      `ALTER TABLE \`user\` CHANGE \`photoId\` \`photoId\` varchar(36) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user\` CHANGE \`roleId\` \`roleId\` int NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user\` CHANGE \`statusId\` \`statusId\` int NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`avmlocation\` CHANGE \`title\` \`title\` varchar(255) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`avmlocation\` CHANGE \`ahaurl\` \`ahaurl\` varchar(255) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`avmlocation\` CHANGE \`ahauser\` \`ahauser\` varchar(255) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`avmlocation\` CHANGE \`ahapassword\` \`ahapassword\` varchar(255) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`avmlocation\` CHANGE \`ahasid\` \`ahasid\` varchar(255) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`room\` CHANGE \`title\` \`title\` varchar(255) NULL COMMENT 'Bezeichnung des Raums'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`room\` CHANGE \`avm_id\` \`avm_id\` varchar(255) NULL COMMENT 'AVM Geräte oder Gruppen ID'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`room\` CHANGE \`comfort_temp\` \`comfort_temp\` int NULL COMMENT 'Temperatur bei aktiver Nutzung'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`room\` CHANGE \`empty_temp\` \`empty_temp\` int NULL COMMENT 'Temperatur im Standby'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`room\` CHANGE \`prelim_time\` \`prelim_time\` int NULL COMMENT 'Vorlaufzeit'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`room\` CHANGE \`heated\` \`heated\` tinyint NULL COMMENT 'Ist aktuell beheizt?'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`room\` CHANGE \`color\` \`color\` varchar(255) NULL COMMENT 'Farbcode für den Kalender'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`room\` CHANGE \`hidden\` \`hidden\` tinyint NULL COMMENT 'Im Kalender ausblenden?'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`session\` DROP FOREIGN KEY \`FK_3d2f174ef04fb312fdebd0ddc53\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`session\` CHANGE \`deletedAt\` \`deletedAt\` datetime(6) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`session\` CHANGE \`userId\` \`userId\` int NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`category\` CHANGE \`title\` \`title\` varchar(255) NULL COMMENT 'Bezeichnung der Kategorie'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`calendarevent\` CHANGE \`start\` \`start\` datetime NULL COMMENT 'Startzeitpunkt'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`calendarevent\` CHANGE \`end\` \`end\` datetime NULL COMMENT 'Endzeitpunkt'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`calendarevent\` CHANGE \`allDay\` \`allDay\` tinyint NULL COMMENT 'Ist es ein Ganztagsevent?'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`calendarevent\` CHANGE \`title\` \`title\` varchar(255) NULL COMMENT 'Titel'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`calendarevent\` CHANGE \`description\` \`description\` varchar(255) NULL COMMENT 'Beschreibung'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`calendarevent\` CHANGE \`isBackground\` \`isBackground\` tinyint NULL COMMENT 'Feiertag oder Ferien?'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`calendarevent\` CHANGE \`rrule\` \`rrule\` varchar(255) NULL COMMENT 'Regel für den Serientermin'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`calendarevent\` CHANGE \`deletedAt\` \`deletedAt\` datetime(6) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user\` ADD CONSTRAINT \`FK_75e2be4ce11d447ef43be0e374f\` FOREIGN KEY (\`photoId\`) REFERENCES \`file\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user\` ADD CONSTRAINT \`FK_c28e52f758e7bbc53828db92194\` FOREIGN KEY (\`roleId\`) REFERENCES \`role\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user\` ADD CONSTRAINT \`FK_dc18daa696860586ba4667a9d31\` FOREIGN KEY (\`statusId\`) REFERENCES \`status\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`session\` ADD CONSTRAINT \`FK_3d2f174ef04fb312fdebd0ddc53\` FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`session\` DROP FOREIGN KEY \`FK_3d2f174ef04fb312fdebd0ddc53\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`user\` DROP FOREIGN KEY \`FK_dc18daa696860586ba4667a9d31\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`user\` DROP FOREIGN KEY \`FK_c28e52f758e7bbc53828db92194\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`user\` DROP FOREIGN KEY \`FK_75e2be4ce11d447ef43be0e374f\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`calendarevent\` CHANGE \`deletedAt\` \`deletedAt\` datetime(6) NULL DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`calendarevent\` CHANGE \`rrule\` \`rrule\` varchar(255) NULL COMMENT 'Regel für den Serientermin' DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`calendarevent\` CHANGE \`isBackground\` \`isBackground\` tinyint NULL COMMENT 'Feiertag oder Ferien?' DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`calendarevent\` CHANGE \`description\` \`description\` varchar(255) NULL COMMENT 'Beschreibung' DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`calendarevent\` CHANGE \`title\` \`title\` varchar(255) NULL COMMENT 'Titel' DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`calendarevent\` CHANGE \`allDay\` \`allDay\` tinyint NULL COMMENT 'Ist es ein Ganztagsevent?' DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`calendarevent\` CHANGE \`end\` \`end\` datetime NULL COMMENT 'Endzeitpunkt' DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`calendarevent\` CHANGE \`start\` \`start\` datetime NULL COMMENT 'Startzeitpunkt' DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`category\` CHANGE \`title\` \`title\` varchar(255) NULL COMMENT 'Bezeichnung der Kategorie' DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`session\` CHANGE \`userId\` \`userId\` int NULL DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`session\` CHANGE \`deletedAt\` \`deletedAt\` datetime(6) NULL DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`session\` ADD CONSTRAINT \`FK_3d2f174ef04fb312fdebd0ddc53\` FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`room\` CHANGE \`hidden\` \`hidden\` tinyint NULL COMMENT 'Im Kalender ausblenden?' DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`room\` CHANGE \`color\` \`color\` varchar(255) NULL COMMENT 'Farbcode für den Kalender' DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`room\` CHANGE \`heated\` \`heated\` tinyint NULL COMMENT 'Ist aktuell beheizt?' DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`room\` CHANGE \`prelim_time\` \`prelim_time\` int NULL COMMENT 'Vorlaufzeit' DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`room\` CHANGE \`empty_temp\` \`empty_temp\` int NULL COMMENT 'Temperatur im Standby' DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`room\` CHANGE \`comfort_temp\` \`comfort_temp\` int NULL COMMENT 'Temperatur bei aktiver Nutzung' DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`room\` CHANGE \`avm_id\` \`avm_id\` varchar(255) NULL COMMENT 'AVM Geräte oder Gruppen ID' DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`room\` CHANGE \`title\` \`title\` varchar(255) NULL COMMENT 'Bezeichnung des Raums' DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`avmlocation\` CHANGE \`ahasid\` \`ahasid\` varchar(255) NULL DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`avmlocation\` CHANGE \`ahapassword\` \`ahapassword\` varchar(255) NULL DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`avmlocation\` CHANGE \`ahauser\` \`ahauser\` varchar(255) NULL DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`avmlocation\` CHANGE \`ahaurl\` \`ahaurl\` varchar(255) NULL DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`avmlocation\` CHANGE \`title\` \`title\` varchar(255) NULL DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user\` CHANGE \`statusId\` \`statusId\` int NULL DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user\` CHANGE \`roleId\` \`roleId\` int NULL DEFAULT 'NULL'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user\` CHANGE \`photoId\` \`photoId\` varchar(36) NULL DEFAULT 'NULL'`,
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
    await queryRunner.query(
      `ALTER TABLE \`user\` ADD CONSTRAINT \`FK_75e2be4ce11d447ef43be0e374f\` FOREIGN KEY (\`photoId\`) REFERENCES \`file\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`avmlocation\` ADD \`testtom\` varchar(255) NULL DEFAULT 'NULL'`,
    );
  }
}
