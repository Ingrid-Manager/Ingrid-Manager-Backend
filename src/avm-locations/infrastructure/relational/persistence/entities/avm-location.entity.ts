import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('avmlocation')
export class AvmLocation {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ nullable: true })
  title!: string;

  @Column({ nullable: true })
  ahaurl!: string;

  @Column({ nullable: true })
  ahauser!: string;

  @Column({ nullable: true })
  ahapassword?: string;

  @Column({ nullable: true })
  ahasid!: string;
}
