import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Ressource } from './infrastructure/relational/persistence/entities/ressource.entity';
import { Repository } from 'typeorm';
import { CreateRessourceDto } from './application/dto/create-ressource.dto';
import { NotFoundError } from 'rxjs';
import { RessourceMapper } from './application/mapper/ressource.mapper';
import { UpdateRessourceDto } from './application/dto/update-ressource.dto';

@Injectable()
export class RessourceService {
  constructor(
    @InjectRepository(Ressource)
    private repo: Repository<Ressource>,
  ) {}

  async create(dto: CreateRessourceDto) {
    const event = this.repo.create(dto);
    return this.repo.save(event);
  }

  async findOne(id: number) {
    const ressource = await this.repo.findOne({
      where: { id },
    });

    if (!ressource) {
      throw new NotFoundError(`Ressource mit id ${id} nicht gefunden`);
    }

    return ressource;
  }

  async findAll() {
    return await this.repo.find();
  }

  async findNames() {
    const ressource = await this.repo.find({
      select: {
        id: true,
        title: true,
        color: true,
      },
      order: {
        title: 'ASC',
      },
    });

    return RessourceMapper.toNameResponse(ressource);
  }

  async update(id: number, dto: UpdateRessourceDto) {
    const ressource = await this.repo.findOne({
      where: { id },
    });

    if (!ressource) {
      throw new NotFoundException(`Ressource mit id ${id} nicht gefunden`);
    }

    Object.assign(ressource, dto);
    return this.repo.save(ressource);
  }
}
