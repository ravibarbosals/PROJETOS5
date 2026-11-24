// GET /indicadores/tempo-acionamento (RN-006, PR-021). Tempos em segundos.
export interface TempoAcionamentoAlerta {
  id: number
  variavel: string
  territorio: string
  nivel: string
  disparado_em: string
  primeira_acao_em: string | null
  tempo_segundos: number | null
}

export interface TempoAcionamento {
  inicio: string
  fim: string
  media_segundos: number | null
  alertas_com_acao: number
  alertas_sem_acao: number
  alertas: TempoAcionamentoAlerta[]
}

// GET /indicadores/decisoes-pendentes (PR-033): alertas ativos sem ação
export interface AlertaPendente {
  id: number
  variavel: string
  territorio: string
  nivel: string
  disparado_em: string
}

export interface DecisoesPendentes {
  total: number
  /** Do disparo mais antigo para o mais novo */
  alertas: AlertaPendente[]
}

// GET /indicadores (MOD-005, DEC-031): casos prováveis por bairro e semana
// epidemiológica.
export type Agravo = 'dengue' | 'chikungunya' | 'zika'

export interface IndicadorTerritorio {
  territorio: string
  bairro: string
  indicador: Agravo
  // Semana epidemiológica: "2025-SE01"
  periodo: string
  valor: number
  fonte: string
  fonte_atualizada_em: string | null
}

export interface FiltrosIndicadores {
  indicador?: Agravo
  ano?: number
  bairro?: string
}
