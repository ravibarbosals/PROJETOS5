import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { NivelAlerta } from '@/modules/alertas/enums/nivel-alerta.enum';
import { StatusAlerta } from '@/modules/alertas/enums/status-alerta.enum';
import { FonteStatusResponseDto } from '@/modules/paineis/fonte-status/dto/fonte-status-response.dto';
import { inicioDaJanela } from '@/modules/paineis/leitura/domain/janela-periodo';
import { PeriodoPainel } from '@/modules/paineis/leitura/enums/periodo-painel.enum';
import { VariavelClimatica } from '@/modules/paineis/leitura/enums/variavel-climatica.enum';
import {
  AreaRiscoDto,
  LimiteRpaDto,
  MapaResponseDto,
  RpaMapaDto,
} from '@/modules/paineis/mapa/dto/mapa-response.dto';
import { areasPrioritarias } from '@/modules/paineis/mapa/domain/area-prioritaria';

// Fontes que o mapa mostra (DEC-038): a chuva e as três do gold do mapa
const FONTES_DO_MAPA = [
  'openmeteo',
  'recife_areas_risco',
  'recife_limites_rpa',
  'ibge_populacao',
];

interface LinhaRpa {
  nome: string;
  rpa: number;
  limite: LimiteRpaDto | null;
  populacao: number | null;
  // numeric chega do pg como string
  chuva_24h_mm: string | null;
  alerta_nivel: NivelAlerta | null;
}

interface LinhaAreaRisco extends Omit<AreaRiscoDto, 'latitude' | 'longitude'> {
  latitude: string;
  longitude: string;
}

// Só leitura: o gold é da pipeline (PR-007) e os alertas, do job (MOD-002).
@Injectable()
export class MapaService {
  constructor(private readonly dataSource: DataSource) {}

  async montar(agora = new Date()): Promise<MapaResponseDto> {
    const [rpas, areas, fontes] = await Promise.all([
      this.rpas(agora),
      this.areasDeRisco(),
      this.dataSource.query<FonteStatusResponseDto[]>(
        `SELECT fonte, ultima_atualizacao FROM gold.fonte_status
         WHERE fonte = ANY($1) ORDER BY fonte`,
        [FONTES_DO_MAPA],
      ),
    ]);
    return { rpas, areas_risco: areas, fontes };
  }

  // DEC-034: a chuva acumula por estação na janela e vale o maior acumulado.
  // O alerta do Recife não pinta RPA: não diz em qual delas aconteceu (nem a
  // torna prioritária, RN-016 #2).
  private async rpas(agora: Date): Promise<RpaMapaDto[]> {
    const linhas = await this.dataSource.query<LinhaRpa[]>(
      `WITH chuva AS (
         SELECT territorio, max(acumulado) AS mm
         FROM (SELECT territorio, sum(valor) AS acumulado
               FROM gold.leitura_climatica
               WHERE variavel = $1 AND lida_em > $2 AND lida_em <= $3
               GROUP BY territorio, fonte, estacao) estacoes
         GROUP BY territorio),
       populacao AS (
         SELECT territorio, sum(populacao)::int AS total
         FROM gold.populacao_bairro GROUP BY territorio),
       alerta AS (
         SELECT territorio,
                max(CASE nivel WHEN $5::text THEN 2 WHEN $6::text THEN 1 END) AS peso
         FROM app.alerta WHERE status = $4 GROUP BY territorio)
       SELECT t.nome, t.rpa, t.limite, p.total AS populacao,
              c.mm AS chuva_24h_mm,
              CASE a.peso WHEN 2 THEN $5::text WHEN 1 THEN $6::text END AS alerta_nivel
       FROM gold.territorio t
       LEFT JOIN chuva c ON c.territorio = t.nome
       LEFT JOIN populacao p ON p.territorio = t.nome
       LEFT JOIN alerta a ON a.territorio = t.nome
       WHERE t.tipo = 'RPA'
       ORDER BY t.rpa`,
      [
        VariavelClimatica.Precipitacao,
        inicioDaJanela(PeriodoPainel.Ultimas24Horas, agora),
        agora,
        StatusAlerta.Ativo,
        NivelAlerta.Alto,
        NivelAlerta.Moderado,
      ],
    );
    const prioridades = areasPrioritarias(linhas);
    return linhas.map((linha) => ({
      ...linha,
      chuva_24h_mm:
        linha.chuva_24h_mm === null ? null : Number(linha.chuva_24h_mm),
      prioridade: prioridades.get(linha.rpa) ?? null,
    }));
  }

  private async areasDeRisco(): Promise<AreaRiscoDto[]> {
    const linhas = await this.dataSource.query<LinhaAreaRisco[]>(
      `SELECT id::int AS id, territorio, bairro, localidade, endereco,
              descricao, nivel, latitude, longitude
       FROM gold.area_risco
       ORDER BY territorio, bairro, id`,
    );
    return linhas.map((linha) => ({
      ...linha,
      latitude: Number(linha.latitude),
      longitude: Number(linha.longitude),
    }));
  }
}
