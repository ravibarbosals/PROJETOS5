import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Usuario } from '@/modules/acesso/entities/usuario.entity';

// Registro de login, só inserção (RN-011, DEC-014). A senha nunca é gravada
// aqui.
@Entity({ name: 'registro_acesso' })
export class RegistroAcesso {
  @PrimaryGeneratedColumn({ name: 'id' })
  id!: number;

  @Column({ name: 'email_informado', type: 'varchar', length: 254 })
  emailInformado!: string;

  @Column({ name: 'id_usuario', type: 'int', nullable: true })
  idUsuario!: number | null;

  @Column({ name: 'sucesso', type: 'boolean' })
  sucesso!: boolean;

  @CreateDateColumn({ name: 'dthr_criacao', type: 'timestamptz', precision: 3 })
  dthrCriacao!: Date;

  @ManyToOne(() => Usuario, { nullable: true })
  @JoinColumn({ name: 'id_usuario' })
  usuario!: Usuario | null;
}
