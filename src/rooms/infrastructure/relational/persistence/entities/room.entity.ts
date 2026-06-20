import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AvmLocation } from '../../../../../avm-locations/infrastructure/relational/persistence/entities/avm-location.entity';

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
}
