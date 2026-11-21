// GET /territorios (MOD-005, DEC-035): o Recife e as 6 RPAs.
export type TipoTerritorio = 'MUNICIPIO' | 'RPA'

export interface Territorio {
  nome: string
  tipo: TipoTerritorio
  /** O Recife para as RPAs; null no município */
  pai: string | null
}

// Território da visão geral (DEC-035), usado enquanto o catálogo carrega.
export const TERRITORIO_PADRAO = 'Recife'
