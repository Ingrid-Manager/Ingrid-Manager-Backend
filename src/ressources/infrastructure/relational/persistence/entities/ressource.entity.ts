import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('ressource')
export class Ressource {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ comment: 'Bezeichnung der Ressource' })
  title!: string;

  @Column({ default: '#808080', comment: 'Anzeigefarbe im Ressourcenkalender' })
  color!: string;

  @Column({
    type: String,
    nullable: true,
    comment: 'E-Mail Adresse des Verwalters der Ressource',
  })
  manager_email?: string | null;

  @Column({
    type: String,
    nullable: true,
    comment: 'Inventarnummer der Ressource',
  })
  inventoryid?: string | null;
}
