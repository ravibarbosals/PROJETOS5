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

// RN-012. Um incidente por variável e território (RN-013, DEC-029). Os campos
// do parâmetro são copiados no disparo ou no escalonamento, para o alerta não
// mudar se o parâmetro mudar depois.
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

  // Leitura que disparou o alerta.
  @Column({ name: 'lida_em', type: 'timestamptz', precision: 3 })
  lidaEm!: Date;

  // Maior valor enquanto ativo (RN-012 #4).
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

  // Até lá o job não encerra o alerta sozinho (RN-015 #6).
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

  // Início do tempo de acionamento (RN-006).
  @Column({
    name: 'dthr_disparo',
    type: 'timestamptz',
    precision: 3,
    default: () => 'now()',
  })
  dthrDisparo!: Date;

  // Último aumento de nível (RN-012 #5).
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
