import {
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { decimalTransformer } from '@/infrastructure/database/transformers/decimal.transformer';
import { NivelAlerta } from '@/modules/alertas/enums/nivel-alerta.enum';

// RN-001. Never deleted, only deactivated (DEC-014).
@Entity({ name: 'parametro_alerta' })
export class ParametroAlerta {
  @PrimaryGeneratedColumn({ name: 'id' })
  id!: number;

  // Value of gold.leitura_climatica.variavel (DEC-009).
  @Column({ name: 'variavel', type: 'varchar', length: 50 })
  variavel!: string;

  // Territory identifier from the gold (DUV-009).
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

  // Hysteresis: the alert only closes below this value (DEC-029, RN-015 #1).
  @Column({
    name: 'limiar_saida',
    type: 'decimal',
    precision: 12,
    scale: 3,
    transformer: decimalTransformer,
  })
  limiarSaida!: number;

  // Rain is summed over the last N hours; other variables use the last reading (RN-012).
  @Column({ name: 'janela_horas', type: 'smallint' })
  janelaHoras!: number;

  @Column({ name: 'nivel', type: 'varchar', length: 20 })
  nivel!: NivelAlerta;

  @Column({ name: 'ativo', type: 'boolean', default: true })
  ativo!: boolean;

  @CreateDateColumn({ name: 'dthr_criacao', type: 'timestamptz', precision: 3 })
  dthrCriacao!: Date;

  // Same as Usuario: set on save() (DEC-017).
  @Column({
    name: 'dthr_atualizacao',
    type: 'timestamptz',
    precision: 3,
    default: () => 'now()',
  })
  dthrAtualizacao!: Date;

  @BeforeUpdate()
  tocarAtualizacao() {
    this.dthrAtualizacao = new Date();
  }
}
