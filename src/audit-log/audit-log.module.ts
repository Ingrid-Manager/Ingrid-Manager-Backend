import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditLog } from './infrastructure/relational/persistence/entities/audit-log.entity';
import { UserEntity } from '../users/infrastructure/persistence/relational/entities/user.entity';
import { AuditLogService } from './audit-log.service';
import { AuditLogController } from './audit-log.controller';
import { AuditErrorFilter } from './filters/audit-error.filter';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AuditLog, UserEntity])],
  providers: [AuditLogService, AuditErrorFilter],
  controllers: [AuditLogController],
  exports: [AuditLogService, AuditErrorFilter],
})
export class AuditLogModule {}
