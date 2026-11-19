import { describe, expect, it } from 'vitest'
import {
  anoDosItens,
  anosDisponiveis,
  resumirArboviroses,
  rotuloSemana,
} from '@/modules/indicadores/arboviroses'
import type { IndicadorTerritorio } from '@/modules/indicadores/types'

const item = (bairro: string, periodo: string, valor: number): IndicadorTerritorio => ({
  territorio: 'Recife',
  bairro,
  indicador: 'dengue',
  periodo,
  valor,
  fonte: 'recife_arboviroses',
  fonte_atualizada_em: null,
})

const itens = [
  item('IBURA', '2025-SE02', 3),
  item('COHAB', '2025-SE01', 4),
  item('IBURA', '2025-SE01', 2),
  item('AFOGADOS', '2025-SE10', 1),
]

describe('resumirArboviroses (DEC-031)', () => {
  it('soma o ano, acha a última semana e o bairro com mais casos', () => {
    const resumo = resumirArboviroses(itens)

    expect(resumo.total).toBe(10)
    expect(resumo.ultimaSemana).toEqual({ chave: '2025-SE10', valor: 1 })
    expect(resumo.bairroComMaisCasos).toEqual({ chave: 'IBURA', valor: 5 })
  })

  it('junta os bairros numa barra por semana, em ordem', () => {
    expect(resumirArboviroses(itens).porSemana).toEqual([
      { chave: '2025-SE01', valor: 6 },
      { chave: '2025-SE02', valor: 3 },
      { chave: '2025-SE10', valor: 1 },
    ])
  })

  it('ordena o ranking por casos e limita a 10 bairros', () => {
    const muitos = Array.from({ length: 12 }, (_, i) =>
      item(`BAIRRO ${String(i).padStart(2, '0')}`, '2025-SE01', i + 1),
    )

    const ranking = resumirArboviroses(muitos).ranking

    expect(ranking).toHaveLength(10)
    expect(ranking[0]).toEqual({ chave: 'BAIRRO 11', valor: 12 })
  })

  it('sem itens: nada a mostrar', () => {
    expect(resumirArboviroses([])).toEqual({
      total: 0,
      ultimaSemana: null,
      bairroComMaisCasos: null,
      porSemana: [],
      ranking: [],
    })
  })
})

describe('apoio às semanas e anos', () => {
  it('mostra a semana sem o ano e acha o ano dos itens', () => {
    expect(rotuloSemana('2025-SE07')).toBe('SE07')
    expect(anoDosItens(itens)).toBe(2025)
    expect(anoDosItens([])).toBeNull()
  })

  it('oferece os 3 anos publicados, do mais recente para o mais antigo', () => {
    expect(anosDisponiveis(2025)).toEqual([2025, 2024, 2023])
  })
})