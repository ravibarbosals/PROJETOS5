// Contratos do MOD-002 (DEC-011: snake_case).

export type StatusAlerta = 'ATIVO' | 'ENCERRADO'

// RN-015: como o alerta foi encerrado.
export type MotivoEncerramento = 'NORMALIZADO' | 'EXPIRADO' | 'MANUAL' | 'INVALIDADO'

export interface Alerta {
  id: number
  nivel: string
  parametro: { id: number; variavel: string; limiar: number }
  territorio: string
  valor_lido: number
  fonte: string
  lida_em: string
  disparado_em: string
  /** Nulo até o contrato do gold (DEC-009, RN-007 #2) */
  fonte_atualizada_em: string | null
  status: StatusAlerta
  /** Enquanto no futuro, o job não encerra o alerta sozinho (RN-015 #6) */
  prorrogado_ate: string | null
  encerrado_em: string | null
  motivo_encerramento: MotivoEncerramento | null
}

// Ações manuais do MOD-002 (PER-014, PER-015); o tipo é o fim da rota.
export type AcaoManual = 'encerrar' | 'prorrogar' | 'invalidar'

export interface AcaoManualRequest {
  /** No mínimo 10 caracteres, sem contar espaços nas pontas (RN-015 #8) */
  motivo: string
  /** Só no prorrogar: inteiro de 1 a 24 */
  horas?: number
}

// DEC-029: dois níveis.
export type NivelAlerta = 'MODERADO' | 'ALTO'

export interface ParametroAlerta {
  id: number
  variavel: string
  territorio: string
  limiar: number
  /** Encerra só abaixo deste valor; menor que o limiar (RN-015) */
  limiar_saida: number
  /** Horas somadas no acumulado da chuva (RN-012) */
  janela_horas: number
  nivel: NivelAlerta
  ativo: boolean
  atualizado_em: string
}

export interface CriarParametroRequest {
  variavel: string
  territorio: string
  limiar: number
  limiar_saida: number
  janela_horas: number
  nivel: NivelAlerta
}

// Variável e território identificam o parâmetro e não mudam.
export interface AlterarParametroRequest {
  limiar?: number
  limiar_saida?: number
  janela_horas?: number
  nivel?: NivelAlerta
  ativo?: boolean
}

export type OperacaoHistorico = 'CRIACAO' | 'ALTERACAO' | 'INATIVACAO'

export interface HistoricoParametro {
  id: number
  operacao: OperacaoHistorico
  valor_anterior: Record<string, unknown> | null
  valor_novo: Record<string, unknown>
  autor: { id: number; nome: string }
  registrado_em: string
}
