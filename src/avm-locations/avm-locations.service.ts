import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AvmLocation } from './infrastructure/relational/persistence/entities/avm-location.entity';
import { Repository } from 'typeorm';
import { CreateAvmLocationDto } from './infrastructure/application/dto/create-avm-location.dto';
import { AvmLoactionMapper } from './infrastructure/application/mapper/avm-location.mapper';
import { UpdateAvmLocationDto } from './infrastructure/application/dto/update-avm-location.dto';
import { AvmConnection } from '../libs/avm-aha-client';
import { CryptoService } from '../crypto/crypto.service';
import { Room } from '../rooms/infrastructure/relational/persistence/entities/room.entity';

@Injectable()
export class AvmLocationsService {
  constructor(
    @InjectRepository(AvmLocation)
    private repo: Repository<AvmLocation>,
    @InjectRepository(Room)
    private roomRepo: Repository<Room>,
    private readonly cryptoService: CryptoService,
  ) {}

  async create(dto: CreateAvmLocationDto) {
    const entity = this.repo.create({
      title: dto.title,
      ahaurl: dto.ahaurl,
      ahauser: dto.ahauser,
      ahapassword: dto.ahapassword
        ? this.cryptoService.encrypt(dto.ahapassword)
        : undefined,
    });

    const saved = await this.repo.save(entity);

    return AvmLoactionMapper.toResponse(saved);
  }

  async findAll() {
    const entities = await this.repo.find({
      order: {
        title: 'ASC',
      },
    });

    return AvmLoactionMapper.toResponses(entities);
  }

  async update(dto: UpdateAvmLocationDto) {
    const entity = await this.repo.findOne({
      where: {
        id: dto.id,
      },
    });

    if (!entity) {
      throw new NotFoundException('AVM Location not found');
    }

    if (dto.title !== undefined) {
      entity.title = dto.title;
    }

    if (dto.ahaurl !== undefined) {
      entity.ahaurl = dto.ahaurl;
    }

    if (dto.ahauser !== undefined) {
      entity.ahauser = dto.ahauser;
    }

    if (dto.ahapassword) {
      entity.ahapassword = this.cryptoService.encrypt(dto.ahapassword);
    }

    const saved = await this.repo.save(entity);
    return AvmLoactionMapper.toResponse(saved);
  }

  async remove(id: number): Promise<void> {
    const entity = await this.repo.findOne({
      where: {
        id,
      },
    });

    if (!entity) {
      throw new NotFoundException('AVM Location not found');
    }

    // Soft-deleted rooms still reference the location via foreign key.
    const roomCount = await this.roomRepo.count({
      where: { locationid: id },
      withDeleted: true,
    });

    if (roomCount > 0) {
      throw new ConflictException(
        `AVM Location ${id} is still used by ${roomCount} room(s)`,
      );
    }

    await this.repo.delete(id);
  }

  async getConnection(id: number): Promise<AvmConnection> {
    const entity = await this.repo.findOne({
      where: {
        id,
      },
    });

    if (!entity) {
      throw new NotFoundException(`AVM Location ${id} not found`);
    }

    return {
      url: entity.ahaurl!,
      username: entity.ahauser!,
      password: this.cryptoService.decrypt(entity.ahapassword!),
    };
  }
}
