import { MigrationInterface, QueryRunner } from 'typeorm';

export class AvmLocationOptionalColumns1790500000000
  implements MigrationInterface
{
  name = 'AvmLocationOptionalColumns1790500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // The AHA connection fields are optional in the API, but the columns
    // were NOT NULL, so creating a location without them failed.
    for (const column of ['ahaurl', 'ahauser', 'ahapassword', 'ahasid']) {
      await queryRunner.query(
        `ALTER TABLE \`avmlocation\` MODIFY \`${column}\` varchar(255) NULL`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const column of ['ahaurl', 'ahauser', 'ahapassword', 'ahasid']) {
      await queryRunner.query(
        `UPDATE \`avmlocation\` SET \`${column}\` = '' WHERE \`${column}\` IS NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE \`avmlocation\` MODIFY \`${column}\` varchar(255) NOT NULL`,
      );
    }
  }
}
