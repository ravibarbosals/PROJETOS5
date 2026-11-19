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

// RN-004: quem, o quê e quando. Só inserção, nunca editada (DEC-014).
@Entity({ name: 'acao' })
export class Acao {
  @PrimaryGeneratedColumn({ name: 'id' })
  id!: number;

  @Column({ name: 'descricao', type: 'varchar', length: 2000 })
  descricao!: string;

  // Ligação opcional com o alerta que motivou a ação (RN-004 #4, RN-006).
  @Column({ name: 'id_alerta', type: 'int', nullable: true })
  idAlerta!: number | null;

  @Column({ name: 'id_usuario', type: 'int' })
  idUsuario!: number;

  // Hora do servidor (RN-004), também a ordem da linha do tempo (RN-005).
  @CreateDateColumn({ name: 'dthr_criacao', type: 'timestamptz', precision: 3 })
  dthrCriacao!: Date;

  @ManyToOne(() => Alerta, { nullable: true })
  @JoinColumn({ name: 'id_alerta' })
  alerta!: Alerta | null;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'id_usuario' })
  usuario!: Usuario;
}
