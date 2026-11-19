import { Usuario } from '@/modules/acesso/entities/usuario.entity';
import { Papel } from '@/modules/acesso/enums/papel.enum';

// Formato de um usuário na API (DEC-011): snake_case, nunca o hash da senha.
export class UsuarioResponseDto {
  id!: number;
  nome!: string;
  email!: string;
  papeis!: Papel[];
  ativo!: boolean;

  static from(usuario: Usuario): UsuarioResponseDto {
    return {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      papeis: (usuario.papeis ?? []).map((p) => p.papel).sort(),
      ativo: usuario.ativo,
    };
  }
}
