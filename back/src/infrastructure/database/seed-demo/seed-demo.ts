import { type DataSource, type EntityManager, Like } from 'typeorm';
import { Usuario } from '@/modules/acesso/entities/usuario.entity';
import type { Papel } from '@/modules/acesso/enums/papel.enum';
import type { PasswordHasher } from '@/modules/acesso/services/password-hasher.service';
import { SENHA_MIN } from '@/modules/acesso/usuario/dto/criar-usuario.dto';
import { TRAVA_ALERTAS } from '@/modules/alertas/avaliacao/services/avaliacao-alertas.service';
import { AlertaAcaoManual } from '@/modules/alertas/entities/alerta-acao-manual.entity';
import { Alerta } from '@/modules/alertas/entities/alerta.entity';
import { ParametroAlertaHistorico } from '@/modules/alertas/entities/parametro-alerta-historico.entity';
import { ParametroAlerta } from '@/modules/alertas/entities/parametro-alerta.entity';
import { StatusAlerta } from '@/modules/alertas/enums/status-alerta.enum';
import { Acao } from '@/modules/rastreio-operacional/entities/acao.entity';
import {
  type AlertaDemo,
  type ChaveParametro,
  DOMINIO_DEMO,
  FONTE_DEMO,
  alertaAtivoDemo,
  cenarioDemo,
} from '@/infrastructure/database/seed-demo/cenario-demo';

export interface OpcoesSeedDemo {
  senha: string;
  ativo: boolean;
  agora?: Date;
}

export interface ResultadoSeedDemo {
  base: 'criado' | 'ja-existe';
  ativo?: 'criado' | 'ja-existe';
}

type Ids = {
  usuarios: Map<Papel, number>;
  parametros: Map<ChaveParametro, ParametroAlerta>;
};

export function validarSenhaDemo(senha: string | undefined): string {
  if (!senha || senha.length < SENHA_MIN) {
    throw new Error(
      `Defina DEMO_SENHA no .env com ${SENHA_MIN} ou mais caracteres`,
    );
  }
  return senha;
}

// TASK-050. Idempotente: os dados-base entram uma vez (marcados pelos e-mails
// @demo.vigia.local); --ativo acrescenta um alerta ATIVO se não houver outro
// para a mesma variável e território (RN-013). A trava do job de alertas
// (DEC-015) evita que ele avalie no meio da escrita.
export async function seedDemo(
  dataSource: DataSource,
  hasher: PasswordHasher,
  opcoes: OpcoesSeedDemo,
): Promise<ResultadoSeedDemo> {
  const agora = opcoes.agora ?? new Date();
  return dataSource.transaction(async (manager) => {
    await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      TRAVA_ALERTAS,
    ]);

    const jaExiste = await manager.exists(Usuario, {
      where: { email: Like(`%@${DOMINIO_DEMO}`) },
    });
    let ids: Ids;
    let base: ResultadoSeedDemo['base'];
    if (jaExiste) {
      ids = await carregarIds(manager);
      base = 'ja-existe';
    } else {
      if (await manager.exists(ParametroAlerta, {})) {
        throw new Error(
          'O banco já tem parâmetros de alerta; o seed de demonstração só roda num banco sem parâmetros',
        );
      }
      ids = await criarBase(manager, hasher, opcoes.senha, agora);
      base = 'criado';
    }

    if (!opcoes.ativo) return { base };
    return { base, ativo: await criarAtivo(manager, ids, agora) };
  });
}

async function criarBase(
  manager: EntityManager,
  hasher: PasswordHasher,
  senha: string,
  agora: Date,
): Promise<Ids> {
  const cenario = cenarioDemo(agora);
  const senhaHash = await hasher.hash(senha);
  const criadoEm = cenario.historico[0].em;

  const usuarios = new Map<Papel, number>();
  for (const u of cenario.usuarios) {
    const salvo = await manager.save(
      Usuario,
      manager.create(Usuario, {
        nome: u.nome,
        email: u.email,
        senhaHash,
        ativo: true,
        papeis: [{ papel: u.papel }],
      }),
    );
    usuarios.set(u.papel, salvo.id);
  }

  const parametros = new Map<ChaveParametro, ParametroAlerta>();
  for (const p of cenario.parametros) {
    // Última alteração no histórico do parâmetro, para o "Atualizado em".
    const atualizadoEm = cenario.historico
      .filter((h) => h.parametro === p.chave)
      .reduce((ultima, h) => (h.em > ultima ? h.em : ultima), criadoEm);
    const salvo = await manager.save(
      ParametroAlerta,
      manager.create(ParametroAlerta, {
        variavel: p.variavel,
        territorio: p.territorio,
        limiar: p.limiar,
        limiarSaida: p.limiarSaida,
        janelaHoras: p.janelaHoras,
        nivel: p.nivel,
        ativo: p.ativo,
        dthrCriacao: criadoEm,
        dthrAtualizacao: atualizadoEm,
      }),
    );
    parametros.set(p.chave, salvo);
  }
  const ids = { usuarios, parametros };

  for (const h of cenario.historico) {
    await manager.insert(ParametroAlertaHistorico, {
      idParametroAlerta: ids.parametros.get(h.parametro)!.id,
      idUsuario: ids.usuarios.get(h.papel)!,
      operacao: h.operacao,
      valorAnterior: h.anterior,
      valorNovo: h.novo,
      dthrCriacao: h.em,
    });
  }

  for (const alerta of cenario.alertas) {
    await inserirAlerta(manager, ids, alerta);
  }
  for (const acao of cenario.acoesAvulsas) {
    await manager.insert(Acao, {
      descricao: acao.descricao,
      idAlerta: null,
      idUsuario: ids.usuarios.get(acao.papel)!,
      dthrCriacao: acao.em,
    });
  }
  return ids;
}

async function criarAtivo(
  manager: EntityManager,
  ids: Ids,
  agora: Date,
): Promise<'criado' | 'ja-existe'> {
  const demo = alertaAtivoDemo(agora);
  const parametro = ids.parametros.get(demo.parametro);
  if (!parametro || ids.usuarios.size < 4) {
    throw new Error(
      'Dados de demonstração incompletos (usuário ou parâmetro de chuva removido); recrie o banco local',
    );
  }
  const ativo = await manager.exists(Alerta, {
    where: {
      variavel: parametro.variavel,
      territorio: parametro.territorio,
      status: StatusAlerta.Ativo,
    },
  });
  if (ativo) return 'ja-existe';
  await inserirAlerta(manager, ids, demo);
  return 'criado';
}

async function inserirAlerta(
  manager: EntityManager,
  ids: Ids,
  a: AlertaDemo,
): Promise<void> {
  const parametro = ids.parametros.get(a.parametro)!;
  const { identifiers } = await manager.insert(Alerta, {
    idParametroAlerta: parametro.id,
    variavel: parametro.variavel,
    territorio: parametro.territorio,
    limiar: parametro.limiar,
    nivel: parametro.nivel,
    ...FONTE_DEMO,
    valorLido: a.valorLido,
    lidaEm: a.lidaEm,
    valorMaximo: a.valorMaximo,
    ultimaLeituraEm: a.ultimaLeituraEm,
    prorrogadoAte: a.prorrogadoAte,
    status: a.encerramento ? StatusAlerta.Encerrado : StatusAlerta.Ativo,
    dthrDisparo: a.disparo,
    dthrEscalonamento: a.escalonamento,
    dthrEncerramento: a.encerramento,
    motivoEncerramento: a.motivoEncerramento,
    dthrCriacao: a.disparo,
    dthrAtualizacao: a.encerramento ?? a.disparo,
  });
  const idAlerta = (identifiers[0] as { id: number }).id;

  for (const m of a.acoesManuais) {
    await manager.insert(AlertaAcaoManual, {
      idAlerta,
      idUsuario: ids.usuarios.get(m.papel)!,
      tipo: m.tipo,
      motivo: m.motivo,
      prorrogadoAte: m.prorrogadoAte,
      dthrCriacao: m.em,
    });
  }
  for (const acao of a.acoes) {
    await manager.insert(Acao, {
      descricao: acao.descricao,
      idAlerta,
      idUsuario: ids.usuarios.get(acao.papel)!,
      dthrCriacao: acao.em,
    });
  }
}

// Base já aplicada: reencontra os usuários pelo e-mail e os parâmetros pelos
// valores do cenário (o ADM pode ter mudado outros parâmetros depois).
async function carregarIds(manager: EntityManager): Promise<Ids> {
  const cenario = cenarioDemo(new Date());
  const usuarios = new Map<Papel, number>();
  for (const u of cenario.usuarios) {
    const salvo = await manager.findOne(Usuario, { where: { email: u.email } });
    if (salvo) usuarios.set(u.papel, salvo.id);
  }
  const parametros = new Map<ChaveParametro, ParametroAlerta>();
  for (const p of cenario.parametros) {
    const salvo = await manager.findOne(ParametroAlerta, {
      where: {
        variavel: p.variavel,
        territorio: p.territorio,
        nivel: p.nivel,
        janelaHoras: p.janelaHoras,
      },
      order: { id: 'ASC' },
    });
    if (salvo) parametros.set(p.chave, salvo);
  }
  return { usuarios, parametros };
}
