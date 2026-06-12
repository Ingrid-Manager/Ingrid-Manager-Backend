import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { CalendarEvent } from '../../../../../calendar-events/infrastructure/relational/persistence/entities/calendar-event.entity';

@Index('IDX_SERIES_EVENT_ACTIVE', ['active'])
@Index('IDX_SERIES_EVENT_LAST_GENERATED', ['lastGeneratedUntil'])
@Entity('seriesevent')
export class SeriesEvent {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  title!: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  description?: string;

  @Column()
  roomid!: number;

  @Column()
  categoryid!: number;

  @Column()
  createdbyid!: number;

  /*
   * Uhrzeit des Serienstarts
   */
  @Column({
    length: 5,
  })
  startTime!: string;

  /*
   * Uhrzeit des Serienendes
   */
  @Column({
    length: 5,
  })
  endTime!: string;

  @Column()
  seriesStart!: Date;
  /*
   * Serie endet vollständig
   */
  @Column()
  seriesEnd!: Date;

  /*
   * [1,3]
   * Montag + Mittwoch
   */
  @Column('simple-json')
  weekdays!: number[];

  /*
   * Ferien berücksichtigen?
   */
  @Column({
    default: true,
  })
  runDuringSchoolHolidays!: boolean;

  /*
   * Serie aktiv?
   */
  @Column({
    default: true,
  })
  active!: boolean;

  /*
   * Bis wann wurden Termine erzeugt?
   */
  @Column({
    nullable: true,
  })
  lastGeneratedUntil?: Date;

  /*
   * Letzter Reorg-Lauf
   */
  @Column({
    nullable: true,
  })
  lastReorganizationAt?: Date;

  @OneToMany(() => CalendarEvent, (event) => event.series)
  events!: CalendarEvent[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
