import {
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  DeleteDateColumn,
  Column,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { UserEntity } from '../../../../../users/infrastructure/persistence/relational/entities/user.entity';

import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';

@Entity({
  name: 'session',
})
export class SessionEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  @Index()
  userId!: number;

  @ManyToOne(() => UserEntity, {
    eager: true,
  })
  @JoinColumn({ name: 'userId' })
  user!: UserEntity;

  @Column()
  hash!: string;

  @CreateDateColumn({
    type: 'datetime',
    precision: 6,
  })
  createdAt?: Date;

  @UpdateDateColumn({
    type: 'datetime',
    precision: 6,
  })
  updatedAt?: Date;

  @DeleteDateColumn({
    type: 'datetime',
    precision: 6,
    nullable: true,
  })
  deletedAt?: Date;
}
