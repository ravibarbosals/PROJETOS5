import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager } from 'typeorm';
import { EnvironmentVariables } from '@/core/config/env.validation';
import {
  AlertaAtivo,
  avaliarLeitura,
  Decisao,
  ParametroAvaliado,
} from '@/modules/alertas/domain/avaliar-leitura';
import {
  LeituraDoGold,
  PontoAvaliado,
  serieDoParametro,
  VARIAVEIS_ACUMULADAS,
} from '@/modules/alertas/domain/serie-de-valores';
import { Alerta } from '@/modules/alertas/entities/alerta.entity';
import { ControleAvaliacaoAlerta } from '@/modules/alertas/entities/controle-avaliacao-alerta.entity';
import { ParametroAlerta } from '@/modules/alertas/entities/parametro-alerta.entity';
import { StatusAlerta } from '@/modules/alertas/enums/status-alerta.enum';

const HORA_MS = 60 * 60 * 1000;

// Chave da trava do PostgreSQL: duas instâncias do back nunca avaliam juntas, e
// uma ação manual nunca acontece no meio de uma avaliação (RN-015).
export const TRAVA_ALERTAS = 'vigia:avaliacao-alertas';

export type ResumoAvaliacao = Record<Decisao['tipo'], number>;

interface LinhaLeitura {
  fonte: string;
  estacao: string;
  lida_em: Date;
  // numeric chega do pg como string
  valor: string;
}

const paraAvaliado = (p: ParametroAlerta): ParametroAvaliado => ({
  id: p.id,
  limiar: p.limiar,
  limiarSaida: p.limiarSaida,
  nivel: p.nivel,
});

// FLX-002 (DEC-015): para cada variável + território com parâmetro ativo ou
// alerta ativo, lê o gold, decide com avaliarLeitura (RN-012, RN-013, RN-015)
// e grava. Tudo numa transação, sob uma trava do PostgreSQL.
@Injectable()
export class AvaliacaoAlertasService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  // null quando outra instância já está avaliando.
  executar(agora = new Date()): Promise<ResumoAvaliacao | null> {
    return this.dataSource.transaction(async (manager) => {
      const [{ obtida }] = await manager.query<{ obtida: boolean }[]>(
        'SELECT pg_try_advisory_xact_lock(hashtext($1)) AS obtida',
        [TRAVA_ALERTAS],
      );
      if (!obtida) return null;

      const parametros = await manager.find(ParametroAlerta, {
        where: { ativo: true },
      });
      const ativos = await manager.find(Alerta, {
        where: { status: StatusAlerta.Ativo },
        relations: { parametroAlerta: true },
      });

      const grupos = new Set(
        [...parametros, ...ativos].map((x) =>
          JSON.stringify([x.variavel, x.territorio]),
        ),
      );
      const resumo: ResumoAvaliacao = {
        NENHUMA: 0,
        DISPARAR: 0,
        ATUALIZAR: 0,
        ESCALONAR: 0,
        ENCERRAR: 0,
      };
      let maisRecente: Date | null = null;

      for (const grupo of grupos) {
        const [variavel, territorio] = JSON.parse(grupo) as [string, string];
        const doGrupo = parametros.filter(
          (p) => p.variavel === variavel && p.territorio === territorio,
        );
        const alerta =
          ativos.find(
            (a) => a.variavel === variavel && a.territorio === territorio,
          ) ?? null;

        const { decisao, pontos, ultimaLeituraEm } = await this.avaliarGrupo(
          manager,
          variavel,
          territorio,
          doGrupo,
          alerta,
          agora,
        );
        await this.aplicar(manager, decisao, pontos, alerta, agora);
        resumo[decisao.tipo] += 1;
        if (
          ultimaLeituraEm &&
          (!maisRecente || ultimaLeituraEm > maisRecente)
        ) {
          maisRecente = ultimaLeituraEm;
        }
      }

      // DEC-015: marcador da última leitura vista, gravado junto com os
      // alertas. Só avança: reavaliar um horário antigo não o faz voltar.
      if (maisRecente) {
        await manager
          .createQueryBuilder()
          .update(ControleAvaliacaoAlerta)
          .set({ ultimaLidaEm: maisRecente, dthrAtualizacao: agora })
          .where('ultima_lida_em IS NULL OR ultima_lida_em < :lidaEm', {
            lidaEm: maisRecente,
          })
          .execute();
      }
      return resumo;
    });
  }

  private async avaliarGrupo(
    manager: EntityManager,
    variavel: string,
    territorio: string,
    parametros: ParametroAlerta[],
    alerta: Alerta | null,
    agora: Date,
  ) {
    const estabilizacaoHoras = this.config.get('ALERTA_ESTABILIZACAO_HORAS', {
      infer: true,
    });
    const expiracaoHoras = this.config.get('ALERTA_EXPIRACAO_HORAS', {
      infer: true,
    });
    const janelas = [
      ...parametros,
      ...(alerta ? [alerta.parametroAlerta] : []),
    ].map((p) => p.janelaHoras);
    // Cobre a janela do acumulado, a estabilização e o prazo de expiração.
    const horas = Math.max(...janelas) + estabilizacaoHoras + expiracaoHoras;

    const linhas = await manager.query<LinhaLeitura[]>(
      `SELECT fonte, estacao, lida_em, valor
       FROM gold.leitura_climatica
       WHERE variavel = $1 AND territorio = $2
         AND lida_em > $3 AND lida_em <= $4`,
      [
        variavel,
        territorio,
        new Date(agora.getTime() - horas * HORA_MS),
        agora,
      ],
    );
    const leituras: LeituraDoGold[] = linhas.map((l) => ({
      fonte: l.fonte,
      estacao: l.estacao,
      lidaEm: l.lida_em,
      valor: Number(l.valor),
    }));
    const acumulada = VARIAVEIS_ACUMULADAS.includes(variavel);

    // Último ponto de cada parâmetro, com a fonte e a estação que deram o valor.
    const pontos = new Map<number, PontoAvaliado>();
    for (const p of parametros) {
      const ultimo = serieDoParametro(leituras, p.janelaHoras, acumulada).at(
        -1,
      );
      if (ultimo) pontos.set(p.id, ultimo);
    }
    const avaliacoes = parametros.flatMap((p) => {
      const ponto = pontos.get(p.id);
      return ponto
        ? [
            {
              parametro: paraAvaliado(p),
              valor: ponto.valor,
              lidaEm: ponto.lidaEm,
            },
          ]
        : [];
    });

    const [{ encerrado_em }] = await manager.query<
      { encerrado_em: Date | null }[]
    >(
      `SELECT max(dthr_encerramento) AS encerrado_em
       FROM app.alerta WHERE variavel = $1 AND territorio = $2`,
      [variavel, territorio],
    );

    const ultimaLeituraEm = leituras.reduce<Date | null>(
      (maior, l) => (!maior || l.lidaEm > maior ? l.lidaEm : maior),
      null,
    );
    const ativo: AlertaAtivo | null = alerta && {
      parametro: paraAvaliado(alerta.parametroAlerta),
      nivel: alerta.nivel,
      valorMaximo: alerta.valorMaximo,
      prorrogadoAte: alerta.prorrogadoAte,
    };

    const decisao = avaliarLeitura({
      avaliacoes,
      alerta: ativo,
      serieDoAlerta: alerta
        ? serieDoParametro(
            leituras,
            alerta.parametroAlerta.janelaHoras,
            acumulada,
          )
        : [],
      ultimaLeituraEm,
      ultimoEncerramentoEm: encerrado_em,
      agora,
      estabilizacaoHoras,
      expiracaoHoras,
    });
    return { decisao, pontos, ultimaLeituraEm };
  }

  private async aplicar(
    manager: EntityManager,
    decisao: Decisao,
    pontos: Map<number, PontoAvaliado>,
    alerta: Alerta | null,
    agora: Date,
  ) {
    if (decisao.tipo === 'NENHUMA') return;

    if (decisao.tipo === 'DISPARAR') {
      const parametro = await manager.findOneByOrFail(ParametroAlerta, {
        id: decisao.avaliacao.parametro.id,
      });
      const ponto = pontos.get(parametro.id);
      if (!ponto) return;
      // RN-013: o índice único parcial barra um segundo alerta ativo.
      await manager.insert(Alerta, {
        idParametroAlerta: parametro.id,
        variavel: parametro.variavel,
        territorio: parametro.territorio,
        limiar: parametro.limiar,
        nivel: parametro.nivel,
        fonte: ponto.fonte,
        estacao: ponto.estacao,
        valorLido: ponto.valor,
        valorMaximo: ponto.valor,
        lidaEm: ponto.lidaEm,
        ultimaLeituraEm: ponto.lidaEm,
        status: StatusAlerta.Ativo,
        dthrDisparo: agora,
      });
      return;
    }

    if (!alerta) return;
    if (decisao.tipo === 'ATUALIZAR') {
      // Reavaliar as mesmas leituras não gera escrita (RN-013 #1).
      const igual =
        alerta.valorMaximo === decisao.valorMaximo &&
        alerta.ultimaLeituraEm.getTime() === decisao.ultimaLeituraEm.getTime();
      if (igual) return;
      await manager.update(Alerta, alerta.id, {
        valorMaximo: decisao.valorMaximo,
        ultimaLeituraEm: decisao.ultimaLeituraEm,
        dthrAtualizacao: agora,
      });
      return;
    }

    if (decisao.tipo === 'ESCALONAR') {
      const parametro = await manager.findOneByOrFail(ParametroAlerta, {
        id: decisao.parametro.id,
      });
      await manager.update(Alerta, alerta.id, {
        idParametroAlerta: parametro.id,
        limiar: parametro.limiar,
        nivel: parametro.nivel,
        valorMaximo: decisao.valorMaximo,
        ultimaLeituraEm: decisao.ultimaLeituraEm,
        dthrEscalonamento: agora,
        dthrAtualizacao: agora,
      });
      return;
    }

    await manager.update(Alerta, alerta.id, {
      status: StatusAlerta.Encerrado,
      motivoEncerramento: decisao.motivo,
      dthrEncerramento: agora,
      dthrAtualizacao: agora,
    });
  }
}
