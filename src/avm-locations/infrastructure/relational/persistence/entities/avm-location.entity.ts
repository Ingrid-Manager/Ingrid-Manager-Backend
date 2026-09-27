import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('avmlocation')
export class AvmLocation {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  title!: string;

  @Column({ type: String, nullable: true })
  ahaurl?: string | null;

  @Column({ type: String, nullable: true })
  ahauser?: string | null;

  @Column({ type: String, nullable: true })
  ahapassword?: string | null;

  @Column({ type: String, nullable: true })
  ahasid?: string | null;
}
