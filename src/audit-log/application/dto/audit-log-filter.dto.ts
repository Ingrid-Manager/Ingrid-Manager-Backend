import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { AuditAction } from '../../audit-action.enum';
import { AuditEntityType } from '../../audit-entity-type.enum';
import { AuditService } from '../../audit-service.enum';

/* Obergrenze für page: vermeidet sehr teure OFFSET-Scans. */
export const MAX_AUDIT_LOG_PAGE = 1000;

export class AuditLogFilterDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  userId?: number;

  @IsOptional()
  @IsEnum(AuditService)
  service?: AuditService;

  @IsOptional()
  @IsEnum(AuditEntityType)
  entityType?: AuditEntityType;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  entityId?: string;

  @IsOptional()
  @IsEnum(AuditAction)
  action?: AuditAction;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_AUDIT_LOG_PAGE)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 25;
}

export class AuditLogEntityParamsDto {
  @IsEnum(AuditEntityType)
  entityType!: AuditEntityType;

  @IsString()
  @MaxLength(255)
  entityId!: string;
}
