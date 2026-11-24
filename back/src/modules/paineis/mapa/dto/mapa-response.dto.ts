import { NivelAlerta } from '@/modules/alertas/enums/nivel-alerta.enum';
import { FonteStatusResponseDto } from '@/modules/paineis/fonte-status/dto/fonte-status-response.dto';

// Contrato do MOD-005 (DEC-038, TASK-062).
export class LimiteRpaDto {
  type!: 'MultiPolygon';
  /** Longitude/latitude (WGS84), na ordem do GeoJSON */
  coordinates!: number[][][][];
}

export class RpaMapaDto {
  nome!: string;
  rpa!: number;
  /** Nulo enquanto a pipeline não gravou o limite */
  limite!: LimiteRpaDto | null;
  /** População residente, Censo 2022 (PR-030); nula sem dado */
  populacao!: number | null;
  /** Maior acumulado de 24 h entre as estações da RPA (DEC-034) */
  chuva_24h_mm!: number | null;
  /** Maior nível entre os alertas ativos da própria RPA (DEC-029) */
  alerta_nivel!: NivelAlerta | null;
  /** Posição entre as áreas prioritárias (RN-016); nula se não é prioritária */
  prioridade!: number | null;
}

export class AreaRiscoDto {
  id!: number;
  territorio!: string;
  bairro!: string;
  localidade!: string;
  endereco!: string;
  descricao!: string;
  /** 1 a 4; nulo em ponto de lona, deslizamento ou não informado */
  nivel!: number | null;
  latitude!: number;
  longitude!: number;
}

export class MapaResponseDto {
  rpas!: RpaMapaDto[];
  areas_risco!: AreaRiscoDto[];
  /** Última atualização das fontes do mapa (RN-007) */
  fontes!: FonteStatusResponseDto[];
}
