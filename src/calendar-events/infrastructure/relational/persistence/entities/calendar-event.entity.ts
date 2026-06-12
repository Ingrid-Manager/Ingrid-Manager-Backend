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
import { Room } from '../../../../../rooms/infrastructure/relational/persistence/entities/room.entity';
import { Category } from '../../../../../categories/infrastructure/relational/persistence/entities/category.entity';
import { UserEntity } from '../../../../../users/infrastructure/persistence/relational/entities/user.entity';
import { SeriesEvent } from '../../../../../series-events/infrastructure/relational/persistence/entities/series-event.entity';

@Index('IDX_CALENDAR_EVENT_SERIES', ['seriesid'])
@Index('IDX_CALENDAR_EVENT_START', ['start'])
@Index('IDX_CALENDAR_EVENT_ROOM_START_END', ['roomid', 'start', 'end'])
@Index('IDX_CALENDAR_EVENT_HOLIDAY_LOOKUP', ['categoryid', 'start', 'end'])
@Index('IDX_CALENDAR_EVENT_DELETED_AT', ['deletedAt'])
@Entity('calendarevent')
export class CalendarEvent {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ nullable: true, comment: 'Startzeitpunkt' })
  start!: Date;

  @Column({ nullable: true, comment: 'Endzeitpunkt' })
  end!: Date;

  @Column({ nullable: true, comment: 'Ist es ein Ganztagsevent?' })
  allDay!: boolean;

  @Column({ nullable: true, comment: 'Titel' })
  title!: string;

  @Column({ nullable: true, comment: 'Beschreibung' })
  description!: string;

  @Column({ nullable: true, comment: 'Feiertag oder Ferien?' })
  isBackground!: boolean;

  /*
   * Referenz auf die Serie
   * NULL = Einzeltermin
   */
  @Column({ nullable: true })
  seriesid?: number | null;

  @ManyToOne(() => SeriesEvent, (series) => series.events, {
    nullable: true,
  })
  @JoinColumn({ name: 'seriesid' })
  series?: SeriesEvent | null;

  /*
   * Termin wurde manuell verändert
   * oder gelöscht
   */
  @Column({
    type: 'boolean',
    default: false,
  })
  isModified!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt!: Date;

  @Column()
  roomid!: number;

  @ManyToOne(() => Room)
  @JoinColumn({ name: 'roomid' })
  room!: Room;

  @Column()
  categoryid!: number;

  @ManyToOne(() => Category)
  @JoinColumn({ name: 'categoryid' })
  category!: Category;

  @Column()
  createdbyid!: number;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'createdbyid' })
  user!: UserEntity;
}
