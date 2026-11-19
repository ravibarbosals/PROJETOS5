import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Usuario } from '@/modules/acesso/entities/usuario.entity';
import { Alerta } from '@/modules/alertas/entities/alerta.entity';
import { TipoAcaoManual } from '@/modules/alertas/enums/tipo-acao-manual.enum';

// RN-015 #8: who closed, invalidated or extended an alert, why and when.
// Insert-only (DEC-014).
@Entity({ name: 'alerta_acao_manual' })
export class AlertaAcaoManual {
  @PrimaryGeneratedColumn({ name: 'id' })
  id!: number;

  @Column({ name: 'id_alerta', type: 'int' })
  idAlerta!: number;

  @Column({ name: 'id_usuario', type: 'int' })
  idUsuario!: number;

  @Column({ name: 'tipo', type: 'varchar', length: 10 })
  tipo!: TipoAcaoManual;

  @Column({ name: 'motivo', type: 'varchar', length: 2000 })
  motivo!: string;

  // Only for PRORROGAR (RN-015 #6).
  @Column({
    name: 'prorrogado_ate',
    type: 'timestamptz',
    precision: 3,
    nullable: true,
  })
  prorrogadoAte!: Date | null;

  // Server time (RN-015 #8).
  @CreateDateColumn({ name: 'dthr_criacao', type: 'timestamptz', precision: 3 })
  dthrCriacao!: Date;

  @ManyToOne(() => Alerta)
  @JoinColumn({ name: 'id_alerta' })
  alerta!: Alerta;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'id_usuario' })
  usuario!: Usuario;
}
