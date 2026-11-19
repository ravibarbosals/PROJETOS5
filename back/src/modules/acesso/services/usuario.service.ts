import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  FilterOperator,
  paginate,
  Paginated,
  PaginateConfig,
  PaginateQuery,
} from 'nestjs-paginate';
import { DataSource, Repository } from 'typeorm';
import { BusinessRuleException } from '@/core/exceptions/business-rule.exception';
import { isUniqueViolation } from '@/infrastructure/database/postgres-errors';
import { AcessoRules } from '@/modules/acesso/acesso.business-rules';
import { UsuarioPapel } from '@/modules/acesso/entities/usuario-papel.entity';
import { Usuario } from '@/modules/acesso/entities/usuario.entity';
import { Papel } from '@/modules/acesso/enums/papel.enum';
import { PasswordHasher } from '@/modules/acesso/services/password-hasher.service';

export interface CriarUsuario {
  nome: string;
  email: string;
  senha: string;
  papeis: Papel[];
}

export interface AlterarUsuario {
  nome?: string;
  senha?: string;
  papeis?: Papel[];
  ativo?: boolean;
}

// DEC-012. O ORDER BY está sempre presente, exigência do SQL Server para o
// OFFSET.
export const USUARIO_PAGINATE_CONFIG: PaginateConfig<Usuario> = {
  sortableColumns: ['id', 'nome', 'email', 'dthrCriacao'],
  defaultSortBy: [['nome', 'ASC']],
  searchableColumns: ['nome', 'email'],
  filterableColumns: { 'papeis.papel': [FilterOperator.EQ] },
  relations: { papeis: true },
  defaultLimit: 20,
  maxLimit: 100,
};

export const SEM_PAPEL_MESSAGE = 'Informe ao menos um papel válido';

export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

function papeisUnicos(papeis: Papel[]): Papel[] {
  const unicos = [...new Set(papeis)];
  // RN-010 #3 (também garantida pelo DTO).
  if (unicos.length === 0)
    throw new UnprocessableEntityException(SEM_PAPEL_MESSAGE);
  return unicos;
}

@Injectable()
export class UsuarioService {
  constructor(
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    private readonly dataSource: DataSource,
    private readonly hasher: PasswordHasher,
  ) {}

  // RN-010: só o administrador cria contas (guard no controller).
  async criar(dados: CriarUsuario): Promise<Usuario> {
    const email = normalizarEmail(dados.email);
    const papeis = papeisUnicos(dados.papeis);

    if (await this.usuarios.exists({ where: { email } })) {
      throw new BusinessRuleException(AcessoRules.EMAIL_JA_CADASTRADO);
    }

    const usuario = this.usuarios.create({
      nome: dados.nome.trim(),
      email,
      senhaHash: await this.hasher.hash(dados.senha),
      ativo: true,
      papeis: papeis.map((papel) => ({ papel })),
    });

    try {
      const salvo = await this.usuarios.save(usuario);
      return this.buscarPorId(salvo.id);
    } catch (error) {
      // Duas requisições com o mesmo e-mail ao mesmo tempo: o índice único
      // decide.
      if (isUniqueViolation(error)) {
        throw new BusinessRuleException(AcessoRules.EMAIL_JA_CADASTRADO);
      }
      throw error;
    }
  }

  async alterar(id: number, dados: AlterarUsuario): Promise<Usuario> {
    await this.dataSource.transaction(async (manager) => {
      const usuario = await manager.findOne(Usuario, { where: { id } });
      if (!usuario) throw new NotFoundException('Usuário não encontrado');

      if (dados.papeis !== undefined) {
        const novos = papeisUnicos(dados.papeis);
        const atuais = await manager.find(UsuarioPapel, {
          where: { idUsuario: id },
        });

        const remover = atuais.filter((atual) => !novos.includes(atual.papel));
        const incluir = novos.filter(
          (papel) => !atuais.some((atual) => atual.papel === papel),
        );

        if (remover.length > 0) await manager.remove(UsuarioPapel, remover);
        if (incluir.length > 0) {
          await manager.insert(
            UsuarioPapel,
            incluir.map((papel) => ({ idUsuario: id, papel })),
          );
        }
      }

      if (dados.nome !== undefined) usuario.nome = dados.nome.trim();
      // PR-020: o administrador redefine a senha.
      if (dados.senha !== undefined) {
        usuario.senhaHash = await this.hasher.hash(dados.senha);
      }
      // DEC-014: usuários são inativados, nunca apagados.
      if (dados.ativo !== undefined) usuario.ativo = dados.ativo;
      usuario.dthrAtualizacao = new Date();

      await manager.save(Usuario, usuario);
    });

    return this.buscarPorId(id);
  }

  listar(query: PaginateQuery): Promise<Paginated<Usuario>> {
    return paginate(query, this.usuarios, USUARIO_PAGINATE_CONFIG);
  }

  async buscarPorId(id: number): Promise<Usuario> {
    const usuario = await this.usuarios.findOne({
      where: { id },
      relations: { papeis: true },
    });
    if (!usuario) throw new NotFoundException('Usuário não encontrado');
    return usuario;
  }

  // Usado pelo AuthGuard a cada requisição; null em vez de 404.
  buscarAutenticado(id: number): Promise<Usuario | null> {
    return this.usuarios.findOne({
      where: { id },
      relations: { papeis: true },
    });
  }

  // Só para a autenticação (TASK-013): a única consulta que carrega o hash da
  // senha.
  buscarParaLogin(email: string): Promise<Usuario | null> {
    return this.usuarios
      .createQueryBuilder('usuario')
      .addSelect('usuario.senhaHash')
      .leftJoinAndSelect('usuario.papeis', 'papel')
      .where('usuario.email = :email', { email: normalizarEmail(email) })
      .getOne();
  }
}
