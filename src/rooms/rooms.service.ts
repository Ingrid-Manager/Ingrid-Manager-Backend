import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateRoomDto } from './application/dto/create-room.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Room } from './infrastructure/relational/persistence/entities/room.entity';
import { NotFoundError } from 'rxjs';
import { RoomMapper } from './application/mappers/room.mapper';
import { UpdateRoomDto } from './application/dto/update-room.dto';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditAction } from '../audit-log/audit-action.enum';
import { AuditEntityType } from '../audit-log/audit-entity-type.enum';
import { AuditService } from '../audit-log/audit-service.enum';

@Injectable()
export class RoomsService {
  constructor(
    @InjectRepository(Room)
    private repo: Repository<Room>,
    private readonly auditLogService: AuditLogService,
  ) {}

  async create(dto: CreateRoomDto, user: any) {
    const room = this.repo.create({
      ...dto,
      createdbyid: user.id,
    });
    const saved = await this.repo.save(room);

    const userLabel = await this.auditLogService.getUserLabel({ id: user.id });
    await this.auditLogService.log({
      user: { id: user.id },
      userLabel,
      action: AuditAction.CREATE,
      service: AuditService.RESOURCES,
      entityType: AuditEntityType.ROOM,
      entityId: saved.id,
      summary: `${userLabel} hat Raum "${saved.title}" angelegt`,
    });

    return saved;
  }

  async findOne(id: number) {
    const room = await this.repo.findOne({
      where: { id },
      relations: ['location'],
    });

    if (!room) {
      throw new NotFoundError(`Room mit id ${id} nicht gefunden`);
    }

    return room;
  }

  async findAll() {
    const rooms = await this.repo.find({
      relations: ['location'],
    });

    return rooms;
  }

  async findNames() {
    const rooms = await this.repo.find({
      select: {
        id: true,
        title: true,
        color: true,
      },
      where: {
        hidden: false,
      },
      order: {
        title: 'ASC',
      },
    });

    return RoomMapper.toNameResponse(rooms);
  }

  async update(id: number, dto: UpdateRoomDto, user: any) {
    const room = await this.repo.findOne({
      where: { id },
    });

    if (!room) {
      throw new NotFoundException(`Raum mit id ${id} nicht gefunden`);
    }

    const before = { ...room };

    Object.assign(room, dto);
    const saved = await this.repo.save(room);

    const userLabel = await this.auditLogService.getUserLabel({ id: user.id });
    await this.auditLogService.log({
      user: { id: user.id },
      userLabel,
      action: AuditAction.UPDATE,
      service: AuditService.RESOURCES,
      entityType: AuditEntityType.ROOM,
      entityId: saved.id,
      summary: `${userLabel} hat Raum "${saved.title}" bearbeitet`,
      changes: this.auditLogService.diff(before, dto as Record<string, unknown>),
    });

    return saved;
  }

  async remove(id: Room['id'], user: any) {
    const room = await this.repo.findOne({ where: { id } });

    if (!room) {
      throw new NotFoundException(`Raum mit id ${id} nicht gefunden`);
    }

    await this.repo.softDelete(id);

    const userLabel = await this.auditLogService.getUserLabel({ id: user.id });
    await this.auditLogService.log({
      user: { id: user.id },
      userLabel,
      action: AuditAction.DELETE,
      service: AuditService.RESOURCES,
      entityType: AuditEntityType.ROOM,
      entityId: id,
      summary: `${userLabel} hat Raum "${room.title}" gelöscht (Soft-Delete)`,
    });
  }
}
