import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StatusEntity } from '../../../../statuses/infrastructure/persistence/relational/entities/status.entity';
import { StatusEnum } from '../../../../statuses/statuses.enum';

@Injectable()
export class StatusSeedService {
  constructor(
    @InjectRepository(StatusEntity)
    private repository: Repository<StatusEntity>,
  ) {}

  async run() {
    const statuses: Array<{ id: StatusEnum; name: string }> = [
      { id: StatusEnum.active, name: 'Active' },
      { id: StatusEnum.inactive, name: 'Inactive' },
      { id: StatusEnum.pending, name: 'Pending' },
      { id: StatusEnum.blocked, name: 'Blocked' },
    ];

    for (const status of statuses) {
      const count = await this.repository.count({
        where: { id: status.id },
      });

      if (!count) {
        await this.repository.save(this.repository.create(status));
      }
    }
  }
}
