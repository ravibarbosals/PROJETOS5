import type { Periodo } from '@/lib/periodo'

// GET /leituras (MOD-005). Datas em UTC; valor já em número.
export type Variavel = 'precipitacao_mm' | 'temperatura_c' | 'umidade_pct' | 'pressao_hpa'

export interface Leitura {
  fonte: string
  estacao: string
  territorio: string
  variavel: Variavel
  valor: number
  lida_em: string
  fonte_atualizada_em: string | null
}

export interface FiltrosLeituras {
  periodo: Periodo
  variavel?: Variavel
  territorio?: string
}