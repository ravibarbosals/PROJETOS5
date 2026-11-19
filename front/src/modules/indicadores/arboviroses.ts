import type { IndicadorTerritorio } from '@/modules/indicadores/types'

export interface TotalPorChave {
  chave: string
  valor: number
}

export interface ResumoArboviroses {
  total: number
  // Última semana com caso publicado
  ultimaSemana: TotalPorChave | null
  bairroComMaisCasos: TotalPorChave | null
  // Recife inteiro, uma barra por semana, em ordem
  porSemana: TotalPorChave[]
  // Os 10 bairros com mais casos no ano
  ranking: TotalPorChave[]
}

// DEC-031: os 3 anos mais recentes publicados
export const ANOS_PUBLICADOS = 3

const somarPor = (itens: IndicadorTerritorio[], chave: (i: IndicadorTerritorio) => string) => {
  const totais = new Map<string, number>()
  for (const item of itens) {
    totais.set(chave(item), (totais.get(chave(item)) ?? 0) + item.valor)
  }
  return [...totais].map(([c, valor]) => ({ chave: c, valor }))
}

// "2025-SE07" → "SE07"
export const rotuloSemana = (periodo: string) => periodo.slice(5)

// Ano da semana epidemiológica dos itens; null sem itens
export const anoDosItens = (itens: IndicadorTerritorio[]) =>
  itens.length === 0 ? null : Number(itens[0].periodo.slice(0, 4))

export const anosDisponiveis = (ultimoAno: number) =>
  Array.from({ length: ANOS_PUBLICADOS }, (_, i) => ultimoAno - i)

export function resumirArboviroses(itens: IndicadorTerritorio[]): ResumoArboviroses {
  const porSemana = somarPor(itens, (i) => i.periodo).sort((a, b) =>
    a.chave.localeCompare(b.chave),
  )
  const porBairro = somarPor(itens, (i) => i.bairro).sort(
    (a, b) => b.valor - a.valor || a.chave.localeCompare(b.chave),
  )

  return {
    total: itens.reduce((soma, i) => soma + i.valor, 0),
    ultimaSemana: porSemana.at(-1) ?? null,
    bairroComMaisCasos: porBairro[0] ?? null,
    porSemana,
    ranking: porBairro.slice(0, 10),
  }
}