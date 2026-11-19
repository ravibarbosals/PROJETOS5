import {
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { decimalTransformer } from '@/infrastructure/database/transformers/decimal.transformer';
import { ParametroAlerta } from '@/modules/alertas/entities/parametro-alerta.entity';
import { MotivoEncerramento } from '@/modules/alertas/enums/motivo-encerramento.enum';
import { NivelAlerta } from '@/modules/alertas/enums/nivel-alerta.enum';
import { StatusAlerta } from '@/modules/alertas/enums/status-alerta.enum';

// RN-012. An incident per variable and territory (RN-013, DEC-029). Parameter
// fields are copied at trigger or escalation time, so the alert does not change
// if the parameter changes later.
@Entity({ name: 'alerta' })
export class Alerta {
  @PrimaryGeneratedColumn({ name: 'id' })
  id!: number;

  @Column({ name: 'id_parametro_alerta', type: 'int' })
  idParametroAlerta!: number;

  @Column({ name: 'variavel', type: 'varchar', length: 50 })
  variavel!: string;

  @Column({ name: 'territorio', type: 'varchar', length: 50 })
  territorio!: string;

  @Column({
    name: 'limiar',
    type: 'decimal',
    precision: 12,
    scale: 3,
    transformer: decimalTransformer,
  })
  limiar!: number;

  @Column({ name: 'nivel', type: 'varchar', length: 20 })
  nivel!: NivelAlerta;

  @Column({ name: 'fonte', type: 'varchar', length: 50 })
  fonte!: string;

  @Column({ name: 'estacao', type: 'varchar', length: 50 })
  estacao!: string;

  @Column({
    name: 'valor_lido',
    type: 'decimal',
    precision: 12,
    scale: 3,
    transformer: decimalTransformer,
  })
  valorLido!: number;

  // Reading that triggered the alert.
  @Column({ name: 'lida_em', type: 'timestamptz', precision: 3 })
  lidaEm!: Date;

  // Highest value while active (RN-012 #4).
  @Column({
    name: 'valor_maximo',
    type: 'decimal',
    precision: 12,
    scale: 3,
    transformer: decimalTransformer,
  })
  valorMaximo!: number;

  @Column({ name: 'ultima_leitura_em', type: 'timestamptz', precision: 3 })
  ultimaLeituraEm!: Date;

  // Until then the job does not close the alert by itself (RN-015 #6).
  @Column({
    name: 'prorrogado_ate',
    type: 'timestamptz',
    precision: 3,
    nullable: true,
  })
  prorrogadoAte!: Date | null;

  @Column({
    name: 'status',
    type: 'varchar',
    length: 10,
    default: StatusAlerta.Ativo,
  })
  status!: StatusAlerta;

  // Start of the response time (RN-006).
  @Column({
    name: 'dthr_disparo',
    type: 'timestamptz',
    precision: 3,
    default: () => 'now()',
  })
  dthrDisparo!: Date;

  // Last level increase (RN-012 #5).
  @Column({
    name: 'dthr_escalonamento',
    type: 'timestamptz',
    precision: 3,
    nullable: true,
  })
  dthrEscalonamento!: Date | null;

  @Column({
    name: 'dthr_encerramento',
    type: 'timestamptz',
    precision: 3,
    nullable: true,
  })
  dthrEncerramento!: Date | null;

  @Column({
    name: 'motivo_encerramento',
    type: 'varchar',
    length: 12,
    nullable: true,
  })
  motivoEncerramento!: MotivoEncerramento | null;

  @CreateDateColumn({ name: 'dthr_criacao', type: 'timestamptz', precision: 3 })
  dthrCriacao!: Date;

  @Column({
    name: 'dthr_atualizacao',
    type: 'timestamptz',
    precision: 3,
    default: () => 'now()',
  })
  dthrAtualizacao!: Date;

  @ManyToOne(() => ParametroAlerta)
  @JoinColumn({ name: 'id_parametro_alerta' })
  parametroAlerta!: ParametroAlerta;

  @BeforeUpdate()
  tocarAtualizacao() {
    this.dthrAtualizacao = new Date();
  }
}
