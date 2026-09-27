import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('avmlocation')
export class AvmLocation {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  title!: string;

  @Column()
  ahaurl?: string;

  @Column()
  ahauser?: string;

  @Column()
  ahapassword?: string;

  @Column()
  ahasid?: string;
}
