import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AvmLocation } from '../../../../../avm-locations/infrastructure/relational/persistence/entities/avm-location.entity';
import { UserEntity } from '../../../../../users/infrastructure/persistence/relational/entities/user.entity';

@Entity('room')
export class Room {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ comment: 'Bezeichnung des Raums' })
  title!: string;

  @Column({
    type: String,
    nullable: true,
    comment: 'AVM Geräte oder Gruppen ID',
  })
  avm_id?: string | null;

  @Column({ comment: 'Temperatur bei aktiver Nutzung' })
  comfort_temp!: number;

  @Column({ comment: 'Temperatur im Standby' })
  empty_temp!: number;

  @Column({ comment: 'Vorlaufzeit' })
  prelim_time!: number;

  @Column({ comment: 'Ist aktuell beheizt?', default: false })
  heated!: boolean;

  @Column({ comment: 'Farbcode für den Kalender' })
  color!: string;

  @Column({
    comment: 'Im Kalender ausblenden?',
    default: false,
  })
  hidden!: boolean;

  @Column()
  locationid!: number;

  @ManyToOne(() => AvmLocation)
  @JoinColumn({ name: 'locationid' })
  location!: AvmLocation;

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

  @Column({ type: 'int' })
  createdbyid!: number;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'createdbyid' })
  user!: UserEntity;
}
