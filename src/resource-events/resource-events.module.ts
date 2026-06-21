import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ResourceEvent } from './infrastructure/relational/persistence/entities/resource-event.entity';

import { ResourceEventsController } from './resource-events.controller';
import { ResourceEventsService } from './resource-events.service';

@Module({
  imports: [TypeOrmModule.forFeature([ResourceEvent])],
  providers: [ResourceEventsService],
  controllers: [ResourceEventsController],
})
export class ResourceEventsModule {}
