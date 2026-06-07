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
import { Room } from '../../../../../rooms/infrastructure/relational/persistence/entities/room.entity';
import { Category } from '../../../../../categories/infrastructure/relational/persistence/entities/category.entity';
import { UserEntity } from '../../../../../users/infrastructure/persistence/relational/entities/user.entity';

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

  @Column({ nullable: true, comment: 'Regel für den Serientermin' })
  rrule!: string;

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
