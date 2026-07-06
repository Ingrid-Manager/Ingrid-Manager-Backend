import { Module } from '@nestjs/common';

import { AvmAhaClientModule } from '../libs/avm-aha-client';

import { AvmTestController } from './avm-test.controller';
import { AvmTestService } from './avm-test.service';

@Module({
  imports: [AvmAhaClientModule.forRoot()],
  controllers: [AvmTestController],
  providers: [AvmTestService],
})
export class AvmTestModule {}
