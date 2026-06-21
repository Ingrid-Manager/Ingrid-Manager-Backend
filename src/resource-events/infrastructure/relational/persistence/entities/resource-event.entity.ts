import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { UserEntity } from '../../../../../users/infrastructure/persistence/relational/entities/user.entity';
import { Resource } from '../../../../../resources/infrastructure/relational/persistence/entities/resource.entity';

@Index('IDX_RESOURCE_EVENT_RESOURCE', ['resourceid'])
@Index('IDX_RESOURCE_EVENT_START', ['start'])
@Index('IDX_RESOURCE_EVENT_END', ['end'])
@Index('IDX_RESOURCE_EVENT_RESOURCE_START_END', ['resourceid', 'start', 'end'])
@Index('IDX_RESOURCE_EVENT_DELETED_AT', ['deletedAt'])
@Entity('resourceevent')
export class ResourceEvent {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({
    comment: 'Titel',
  })
  title!: string;

  @Column({
    comment: 'Startzeitpunkt',
    type: 'datetime',
  })
  start!: Date;

  @Column({
    comment: 'Endzeitpunkt',
    type: 'datetime',
  })
  end!: Date;

  @CreateDateColumn({
    type: 'datetime',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    type: 'datetime',
  })
  updatedAt!: Date;

  @DeleteDateColumn({
    type: 'datetime',
  })
  deletedAt!: Date;

  @Column({ type: 'int' })
  resourceid!: number;

  @ManyToOne(() => Resource)
  @JoinColumn({ name: 'resourceid' })
  resource!: Resource;

  @Column({ type: 'int' })
  createdbyid!: number;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'createdbyid' })
  user!: UserEntity;
}
