import { Injectable } from '@nestjs/common';
import { CreateRoomDto } from './application/dto/create-room.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Room } from './infrastructure/relational/persistence/entities/room.entity';
import { NotFoundError } from 'rxjs';
import { RoomMapper } from './application/mappers/room.mapper';

@Injectable()
export class RoomsService {
  constructor(
    @InjectRepository(Room)
    private repo: Repository<Room>,
  ) {}

  async create(dto: CreateRoomDto) {
    const event = this.repo.create(dto);
    return this.repo.save(event);
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
}
