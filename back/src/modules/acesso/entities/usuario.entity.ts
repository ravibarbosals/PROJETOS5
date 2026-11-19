import {
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UsuarioPapel } from '@/modules/acesso/entities/usuario-papel.entity';

@Entity({ name: 'usuario' })
export class Usuario {
  @PrimaryGeneratedColumn({ name: 'id' })
  id!: number;

  @Column({ name: 'nome', type: 'varchar', length: 150 })
  nome!: string;

  @Column({ name: 'email', type: 'varchar', length: 254 })
  email!: string;

  // Nunca devolvido pelas consultas padrão (DEC-013).
  @Column({ name: 'senha_hash', type: 'varchar', length: 255, select: false })
  senhaHash!: string;

  @Column({ name: 'ativo', type: 'boolean', default: true })
  ativo!: boolean;

  @CreateDateColumn({ name: 'dthr_criacao', type: 'timestamptz', precision: 3 })
  dthrCriacao!: Date;

  // Não é @UpdateDateColumn: a própria entidade preenche no save() (DEC-017).
  @Column({
    name: 'dthr_atualizacao',
    type: 'timestamptz',
    precision: 3,
    default: () => 'now()',
  })
  dthrAtualizacao!: Date;

  @OneToMany(() => UsuarioPapel, (papel) => papel.usuario, {
    cascade: ['insert'],
  })
  papeis!: UsuarioPapel[];

  @BeforeUpdate()
  tocarAtualizacao() {
    this.dthrAtualizacao = new Date();
  }
}
