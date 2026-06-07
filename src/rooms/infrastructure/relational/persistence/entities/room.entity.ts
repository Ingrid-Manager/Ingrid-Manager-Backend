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

  @Column({ nullable: true, comment: 'Bezeichnung des Raums' })
  title!: string;

  @Column({ nullable: true, comment: 'AVM Geräte oder Gruppen ID' })
  avm_id!: string;

  @Column({ nullable: true, comment: 'Temperatur bei aktiver Nutzung' })
  comfort_temp!: number;

  @Column({ nullable: true, comment: 'Temperatur im Standby' })
  empty_temp!: number;

  @Column({ nullable: true, comment: 'Vorlaufzeit' })
  prelim_time!: number;

  @Column({ nullable: true, comment: 'Ist aktuell beheizt?' })
  heated!: boolean;

  @Column({ nullable: true, comment: 'Farbcode für den Kalender' })
  color!: string;

  @Column({ nullable: true, comment: 'Im Kalender ausblenden?' })
  hidden!: boolean;

  @Column()
  locationid!: number;

  @ManyToOne(() => AvmLocation)
  @JoinColumn({ name: 'locationid' })
  location!: AvmLocation;
}
