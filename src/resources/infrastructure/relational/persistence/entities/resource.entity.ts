import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('resource')
export class Resource {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ comment: 'Bezeichnung der Resource' })
  title!: string;

  @Column({ default: '#808080', comment: 'Anzeigefarbe im Resourcenkalender' })
  color!: string;

  @Column({
    type: String,
    nullable: true,
    comment: 'E-Mail Adresse des Verwalters der Resource',
  })
  manager_email?: string | null;

  @Column({
    type: String,
    nullable: true,
    comment: 'Inventarnummer der Resource',
  })
  inventoryid?: string | null;
}
