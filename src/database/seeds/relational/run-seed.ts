import { NestFactory } from '@nestjs/core';
import { HolidaySeedService } from './holiday/holiday-seed.service';
import { RoleSeedService } from './role/role-seed.service';
import { SeedModule } from './seed.module';
import { StatusSeedService } from './status/status-seed.service';
import { UserSeedService } from './user/user-seed.service';

const runSeed = async () => {
  const app = await NestFactory.create(SeedModule);

  // run
  await app.get(RoleSeedService).run();
  await app.get(StatusSeedService).run();
  await app.get(UserSeedService).run();
  // nach den Usern: der Ferienraum braucht einen Ersteller
  await app.get(HolidaySeedService).run();

  await app.close();
};

void runSeed();
