import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Usuario } from '@/modules/acesso/entities/usuario.entity';
import { ParametroAlerta } from '@/modules/alertas/entities/parametro-alerta.entity';
import { OperacaoHistorico } from '@/modules/alertas/enums/operacao-historico.enum';

// Registro de alterações de um parâmetro, só inserção (RN-001: quem, quando,
// antes -> depois).
@Entity({ name: 'parametro_alerta_historico' })
export class ParametroAlertaHistorico {
  @PrimaryGeneratedColumn({ name: 'id' })
  id!: number;

  @Column({ name: 'id_parametro_alerta', type: 'int' })
  idParametroAlerta!: number;

  @Column({ name: 'id_usuario', type: 'int' })
  idUsuario!: number;

  @Column({ name: 'operacao', type: 'varchar', length: 12 })
  operacao!: OperacaoHistorico;

  // Nulo na criação.
  @Column({ name: 'valor_anterior', type: 'jsonb', nullable: true })
  valorAnterior!: Record<string, unknown> | null;

  @Column({ name: 'valor_novo', type: 'jsonb' })
  valorNovo!: Record<string, unknown>;

  @CreateDateColumn({ name: 'dthr_criacao', type: 'timestamptz', precision: 3 })
  dthrCriacao!: Date;

  @ManyToOne(() => ParametroAlerta)
  @JoinColumn({ name: 'id_parametro_alerta' })
  parametroAlerta!: ParametroAlerta;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'id_usuario' })
  usuario!: Usuario;
}
