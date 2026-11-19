import { BeforeUpdate, Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

// Linha única com o marcador do job de alertas (DEC-015). Criada pela migração.
@Entity({ name: 'controle_avaliacao_alerta' })
export class ControleAvaliacaoAlerta {
  @PrimaryGeneratedColumn({ name: 'id' })
  id!: number;

  // Nulo significa que o job nunca rodou. Só avança depois que os alertas são
  // gravados.
  @Column({
    name: 'ultima_lida_em',
    type: 'timestamptz',
    precision: 3,
    nullable: true,
  })
  ultimaLidaEm!: Date | null;

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
