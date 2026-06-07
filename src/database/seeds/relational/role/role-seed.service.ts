import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoleEntity } from '../../../../roles/infrastructure/persistence/relational/entities/role.entity';
import { RoleEnum } from '../../../../roles/roles.enum';

@Injectable()
export class RoleSeedService {
  constructor(
    @InjectRepository(RoleEntity)
    private repository: Repository<RoleEntity>,
  ) {}

  async run() {
    const countUser = await this.repository.count({
      where: {
        id: RoleEnum.user,
      },
    });

    if (!countUser) {
      await this.repository.save(
        this.repository.create({
          id: RoleEnum.user,
          name: 'user',
        }),
      );
    }

    const countAdmin = await this.repository.count({
      where: {
        id: RoleEnum.admin,
      },
    });

    if (!countAdmin) {
      await this.repository.save(
        this.repository.create({
          id: RoleEnum.admin,
          name: 'admin',
        }),
      );
    }

    const countVerwaltung = await this.repository.count({
      where: {
        id: RoleEnum.verwaltung,
      },
    });

    if (!countVerwaltung) {
      await this.repository.save(
        this.repository.create({
          id: RoleEnum.verwaltung,
          name: 'verwaltung',
        }),
      );
    }

    const countGuest = await this.repository.count({
      where: {
        id: RoleEnum.guest,
      },
    });

    if (!countGuest) {
      await this.repository.save(
        this.repository.create({
          id: RoleEnum.guest,
          name: 'guest',
        }),
      );
    }
  }
}
