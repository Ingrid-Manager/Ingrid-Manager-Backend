import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedMissingStatuses1789840745859 implements MigrationInterface {
  name = 'SeedMissingStatuses1789840745859';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // `status` only ever contained 'Active' (1) and 'Inactive' (2).
    // 'Pending' (3, set by the email confirmation) and 'Blocked' (4, used
    // by the admin UI) were never inserted, so assigning either of them to
    // a user fails with a foreign key violation on `user.statusId`.
    await queryRunner.query(
      `INSERT IGNORE INTO \`status\` (\`id\`, \`name\`) VALUES (3, 'Pending'), (4, 'Blocked')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM \`status\` WHERE \`id\` IN (3, 4)`);
  }
}
