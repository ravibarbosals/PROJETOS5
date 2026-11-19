import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { PeriodoQueryDto } from '@/core/dto/periodo-query.dto';
import { Alerta } from '@/modules/alertas/entities/alerta.entity';
import { MotivoEncerramento } from '@/modules/alertas/enums/motivo-encerramento.enum';
import {
  calcularTempoAcionamento,
  tempoAcionamentoMs,
  type AlertaComAcoes,
} from '@/modules/rastreio-operacional/domain/calcular-tempo-acionamento';
import type { TempoAcionamentoResponseDto } from '@/modules/rastreio-operacional/dto/tempo-acionamento-response.dto';
import { Acao } from '@/modules/rastreio-operacional/entities/acao.entity';

export interface AlertaComPrimeiraAcao {
  id: number;
  variavel: string;
  territorio: string;
  nivel: string;
  dthr_disparo: Date;
  primeira_acao_em: Date | null;
}

const paraSegundos = (ms: number | null) =>
  ms === null ? null : Math.round(ms / 1000);

// Mapeamento puro das linhas da consulta para o formato da API (RN-006,
// PR-021).
export function montarTempoAcionamento(
  periodo: PeriodoQueryDto,
  linhas: AlertaComPrimeiraAcao[],
): TempoAcionamentoResponseDto {
  const alertas: AlertaComAcoes[] = linhas.map((linha) => ({
    dthrDisparo: linha.dthr_disparo,
    acoes: linha.primeira_acao_em
      ? [{ dthrCriacao: linha.primeira_acao_em }]
      : [],
  }));
  const resumo = calcularTempoAcionamento(alertas);

  return {
    inicio: periodo.inicio,
    fim: periodo.fim,
    media_segundos: paraSegundos(resumo.mediaMs),
    alertas_com_acao: resumo.alertasComAcao,
    alertas_sem_acao: resumo.alertasSemAcao,
    alertas: linhas.map((linha, i) => ({
      id: linha.id,
      variavel: linha.variavel,
      territorio: linha.territorio,
      nivel: linha.nivel,
      disparado_em: linha.dthr_disparo,
      primeira_acao_em: linha.primeira_acao_em,
      tempo_segundos: paraSegundos(tempoAcionamentoMs(alertas[i])),
    })),
  };
}

@Injectable()
export class TempoAcionamentoService {
  constructor(
    @InjectRepository(Alerta) private readonly alertas: Repository<Alerta>,
  ) {}

  // Alertas disparados no período (inclusive) com a primeira ação ligada. Uma
  // consulta agrupada em vez de uma consulta por alerta. Alerta invalidado
  // (falso positivo) não conta (RN-015 #5).
  async calcular(
    periodo: PeriodoQueryDto,
  ): Promise<TempoAcionamentoResponseDto> {
    const linhas = await this.alertas
      .createQueryBuilder('alerta')
      .leftJoin(Acao, 'acao', 'acao.id_alerta = alerta.id')
      .select('alerta.id', 'id')
      .addSelect('alerta.variavel', 'variavel')
      .addSelect('alerta.territorio', 'territorio')
      .addSelect('alerta.nivel', 'nivel')
      .addSelect('alerta.dthr_disparo', 'dthr_disparo')
      .addSelect('MIN(acao.dthr_criacao)', 'primeira_acao_em')
      .where('alerta.dthr_disparo BETWEEN :inicio AND :fim', periodo)
      .andWhere('alerta.motivo_encerramento IS DISTINCT FROM :invalidado', {
        invalidado: MotivoEncerramento.Invalidado,
      })
      .groupBy('alerta.id')
      .addGroupBy('alerta.variavel')
      .addGroupBy('alerta.territorio')
      .addGroupBy('alerta.nivel')
      .addGroupBy('alerta.dthr_disparo')
      .orderBy('alerta.dthr_disparo', 'ASC')
      .getRawMany<AlertaComPrimeiraAcao>();

    return montarTempoAcionamento(periodo, linhas);
  }
}
