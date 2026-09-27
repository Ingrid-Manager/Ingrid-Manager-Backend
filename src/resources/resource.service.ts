import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Resource } from './infrastructure/relational/persistence/entities/resource.entity';
import { Repository } from 'typeorm';
import { CreateResourceDto } from './application/dto/create-resource.dto';
import { NotFoundError } from 'rxjs';
import { ResourceMapper } from './application/mapper/resource.mapper';
import { UpdateResourceDto } from './application/dto/update-resource.dto';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditAction } from '../audit-log/audit-action.enum';
import { AuditEntityType } from '../audit-log/audit-entity-type.enum';
import { AuditService } from '../audit-log/audit-service.enum';

@Injectable()
export class ResourceService {
  constructor(
    @InjectRepository(Resource)
    private repo: Repository<Resource>,
    private readonly auditLogService: AuditLogService,
  ) {}

  async create(dto: CreateResourceDto, user: any) {
    const event = this.repo.create(dto);
    const saved = await this.repo.save(event);

    const userLabel = await this.auditLogService.getUserLabel({ id: user.id });
    await this.auditLogService.log({
      user: { id: user.id },
      userLabel,
      action: AuditAction.CREATE,
      service: AuditService.RESOURCES,
      entityType: AuditEntityType.RESOURCE,
      entityId: saved.id,
      summary: `${userLabel} hat Resource "${saved.title}" angelegt`,
    });

    return saved;
  }

  async findOne(id: number) {
    const resource = await this.repo.findOne({
      where: { id },
    });

    if (!resource) {
      throw new NotFoundError(`Resource mit id ${id} nicht gefunden`);
    }

    return resource;
  }

  async findAll() {
    return await this.repo.find();
  }

  async findNames() {
    const resource = await this.repo.find({
      select: {
        id: true,
        title: true,
        color: true,
      },
      order: {
        title: 'ASC',
      },
    });

    return ResourceMapper.toNameResponse(resource);
  }

  async update(id: number, dto: UpdateResourceDto, user: any) {
    const resource = await this.repo.findOne({
      where: { id },
    });

    if (!resource) {
      throw new NotFoundException(`Resource mit id ${id} nicht gefunden`);
    }

    const before = { ...resource };

    Object.assign(resource, dto);
    const saved = await this.repo.save(resource);

    const userLabel = await this.auditLogService.getUserLabel({ id: user.id });
    await this.auditLogService.log({
      user: { id: user.id },
      userLabel,
      action: AuditAction.UPDATE,
      service: AuditService.RESOURCES,
      entityType: AuditEntityType.RESOURCE,
      entityId: saved.id,
      summary: `${userLabel} hat Resource "${saved.title}" bearbeitet`,
      changes: this.auditLogService.diff(before, dto as Record<string, unknown>),
    });

    return saved;
  }
}
