import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ResourceEvent } from './infrastructure/relational/persistence/entities/resource-event.entity';

import { ResourceEventFilterDto } from './application/dto/resource-event-filter.dto';
import { CreateResourceEventDto } from './application/dto/create-resource-event.dto';
import { UpdateResourceEventDto } from './application/dto/update-resource-event.dto';

import { ResourceEventMapper } from './application/mappers/resource-event.mapper';

import { RoleEnum } from '../roles/roles.enum';

@Injectable()
export class ResourceEventsService {
  constructor(
    @InjectRepository(ResourceEvent)
    private repo: Repository<ResourceEvent>,
  ) {}

  private validateDateRange(start: string | Date, end: string | Date): void {
    if (new Date(start) > new Date(end)) {
      throw new ConflictException(
        'Der Startzeitpunkt muss vor dem Endzeitpunkt liegen.',
      );
    }
  }

  private async validateNoOverlap(
    resourceid: number,
    start: string | Date,
    end: string | Date,
    excludeId?: number,
  ): Promise<void> {
    const qb = this.repo
      .createQueryBuilder('event')
      .where('event.resourceid = :resourceid', { resourceid })
      .andWhere('event.start < :end', { end })
      .andWhere('event.end > :start', { start });

    if (excludeId) {
      qb.andWhere('event.id != :excludeId', { excludeId });
    }

    const existingEvent = await qb.getOne();

    if (existingEvent) {
      throw new ConflictException(
        'Für diese Ressource existiert bereits eine Buchung in diesem Zeitraum.',
      );
    }
  }

  async create(dto: CreateResourceEventDto, user: any) {
    this.validateDateRange(dto.start, dto.end);
    await this.validateNoOverlap(dto.resourceid, dto.start, dto.end);

    const event = this.repo.create({
      title: dto.title,
      start: new Date(dto.start),
      end: new Date(dto.end),
      resourceid: dto.resourceid,
      createdbyid: user.id,
    });

    return this.repo.save(event);
  }

  async findInRange(filter: ResourceEventFilterDto) {
    const qb = this.repo
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.resource', 'resource')
      .leftJoinAndSelect('event.user', 'user')
      .where('event.start <= :end', { end: filter.end })
      .andWhere('event.end >= :start', { start: filter.start });

    if (filter.resourceid) {
      qb.andWhere('event.resourceid = :resourceid', {
        resourceid: filter.resourceid,
      });
    }

    const events = await qb.getMany();

    return events.map(ResourceEventMapper.toResponse);
  }

  async update(dto: UpdateResourceEventDto, user: any) {
    const event = await this.repo.findOne({
      where: { id: dto.id },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    if (user.role?.name === RoleEnum.user && event.createdbyid !== user.id) {
      throw new ForbiddenException('You cannot edit this event');
    }

    this.validateDateRange(dto.start, dto.end);
    await this.validateNoOverlap(
      dto.resourceid ?? event.resourceid,
      dto.start ?? event.start,
      dto.end ?? event.end,
      event.id,
    );

    Object.assign(event, dto);

    return this.repo.save(event);
  }

  async delete(id: number, user: any) {
    const event = await this.repo.findOne({
      where: { id },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    if (user.role?.name === RoleEnum.user && event.createdbyid !== user.id) {
      throw new ForbiddenException('You cannot delete this event');
    }

    await this.repo.softDelete(id);

    return {
      success: true,
    };
  }
}
