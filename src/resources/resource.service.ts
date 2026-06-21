import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Resource } from './infrastructure/relational/persistence/entities/resource.entity';
import { Repository } from 'typeorm';
import { CreateResourceDto } from './application/dto/create-resource.dto';
import { NotFoundError } from 'rxjs';
import { ResourceMapper } from './application/mapper/resource.mapper';
import { UpdateResourceDto } from './application/dto/update-resource.dto';

@Injectable()
export class ResourceService {
  constructor(
    @InjectRepository(Resource)
    private repo: Repository<Resource>,
  ) {}

  async create(dto: CreateResourceDto) {
    const event = this.repo.create(dto);
    return this.repo.save(event);
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

  async update(id: number, dto: UpdateResourceDto) {
    const resource = await this.repo.findOne({
      where: { id },
    });

    if (!resource) {
      throw new NotFoundException(`Resource mit id ${id} nicht gefunden`);
    }

    Object.assign(resource, dto);
    return this.repo.save(resource);
  }
}
