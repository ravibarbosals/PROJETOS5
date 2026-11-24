import type { NivelAlerta } from '@/modules/alertas/types'

// GET /mapa (MOD-005, DEC-038, TASK-062).
export interface LimiteRpa {
  type: 'MultiPolygon'
  /** Longitude/latitude, na ordem do GeoJSON */
  coordinates: number[][][][]
}

export interface RpaMapa {
  nome: string
  rpa: number
  /** null enquanto a pipeline não gravou o limite */
  limite: LimiteRpa | null
  /** População residente, Censo 2022 (PR-030) */
  populacao: number | null
  /** Maior acumulado de 24 h entre as estações da RPA (DEC-034) */
  chuva_24h_mm: number | null
  /** Maior nível entre os alertas ativos da própria RPA */
  alerta_nivel: NivelAlerta | null
  /** Posição entre as áreas prioritárias (RN-016), 1 = maior população; null se não é */
  prioridade: number | null
}

export interface AreaRisco {
  id: number
  territorio: string
  bairro: string
  localidade: string
  endereco: string
  descricao: string
  /** 1 a 4; null em ponto de lona, deslizamento ou não informado */
  nivel: number | null
  latitude: number
  longitude: number
}

export interface FonteDoMapa {
  fonte: string
  ultima_atualizacao: string
}

export interface Mapa {
  rpas: RpaMapa[]
  areas_risco: AreaRisco[]
  fontes: FonteDoMapa[]
}

// O que pinta as RPAs (DEC-038)
export type CamadaRpa = 'alerta' | 'chuva'
