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

  @Column({ comment: 'Startzeitpunkt', type: 'datetime' })
  start!: Date;

  @Column({ comment: 'Endzeitpunkt', type: 'datetime' })
  end!: Date;

  @Column({ comment: 'Ist es ein Ganztagsevent?', default: false })
  allDay!: boolean;

  @Column({ comment: 'Titel' })
  title!: string;

  @Column({ comment: 'Beschreibung' })
  description?: string;

  @Column({ comment: 'Feiertag oder Ferien?', default: false })
  isBackground?: boolean;

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
  roomid!: number;

  @ManyToOne(() => Room)
  @JoinColumn({ name: 'roomid' })
  room!: Room;

  @Column({ type: 'int' })
  categoryid!: number;

  @ManyToOne(() => Category)
  @JoinColumn({ name: 'categoryid' })
  category!: Category;

  @Column({ type: 'int' })
  createdbyid!: number;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'createdbyid' })
  user!: UserEntity;
}
