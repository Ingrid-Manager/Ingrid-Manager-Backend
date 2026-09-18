import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UserEntity } from '../../../../../users/infrastructure/persistence/relational/entities/user.entity';
import { AuditAction } from '../../../../audit-action.enum';
import { AuditService } from '../../../../audit-service.enum';

@Index('IDX_AUDITLOG_ENTITY', ['entityType', 'entityId'])
@Index('IDX_AUDITLOG_CREATED_AT', ['createdAt'])
@Index('IDX_AUDITLOG_USER', ['userId'])
@Index('IDX_AUDITLOG_SERVICE', ['service'])
@Entity('auditlog')
export class AuditLog {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int', nullable: true, comment: 'Ausführender User' })
  userId?: number | null;

  /*
   * Keine Cascade-Löschung: User werden nie hart gelöscht (nur softDelete),
   * userLabel dient als Fallback, falls die Relation dennoch fehlt.
   */
  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'userId' })
  user?: UserEntity | null;

  @Column({
    type: String,
    nullable: true,
    comment: 'Denormalisierter Anzeigename des Users zum Zeitpunkt der Aktion',
  })
  userLabel?: string | null;

  @Column({ type: 'varchar', comment: 'Art der Aktion' })
  action!: AuditAction;

  @Column({
    type: 'varchar',
    comment: 'Fachliches Modul, z.B. events, resources, auth',
  })
  service!: AuditService;

  @Column({ comment: 'Betroffener Entitätstyp, z.B. calendar-event' })
  entityType!: string;

  @Column({
    type: String,
    nullable: true,
    comment: 'ID der betroffenen Entität (als String)',
  })
  entityId?: string | null;

  @Column({ type: 'text', comment: 'Lesbarer Klartext der Aktion' })
  summary!: string;

  @Column({
    type: 'json',
    nullable: true,
    comment: 'Geänderte Felder bei UPDATE: { feld: { old, new } }',
  })
  changes?: Record<string, { old: unknown; new: unknown }> | null;

  @Column({ type: String, nullable: true })
  ip?: string | null;

  @Column({ type: String, nullable: true })
  userAgent?: string | null;

  @CreateDateColumn({
    type: 'datetime',
  })
  createdAt!: Date;
}
