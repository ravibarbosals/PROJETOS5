import { describe, expect, it } from 'vitest'
import {
  areasPrioritarias,
  atualizacaoDaFonte,
  corDaChuva,
  corDoAlerta,
  corDoRisco,
  enquadramento,
  LEGENDA_ALERTA,
  LEGENDA_CHUVA,
  LEGENDA_RISCO,
  pessoasEmRisco,
  populacaoTotal,
  rotuloDaPrioridade,
  rotuloDoRisco,
} from '@/modules/mapa/camadas'
import type { RpaMapa } from '@/modules/mapa/types'

const rpa = (populacao: number | null): RpaMapa => ({
  nome: 'RPA 1 - Centro',
  rpa: 1,
  limite: null,
  populacao,
  chuva_24h_mm: null,
  alerta_nivel: null,
  prioridade: null,
})

const cor = (legenda: { rotulo: string; cor: string }[], rotulo: string) =>
  legenda.find((i) => i.rotulo === rotulo)!.cor

describe('camadas do mapa (DEC-038)', () => {
  it('pinta o alerta pelo nível, e cinza sem alerta ativo', () => {
    expect(corDoAlerta('ALTO')).toBe(cor(LEGENDA_ALERTA, 'Alerta alto'))
    expect(corDoAlerta('MODERADO')).toBe(cor(LEGENDA_ALERTA, 'Alerta moderado'))
    expect(corDoAlerta(null)).toBe(cor(LEGENDA_ALERTA, 'Sem alerta ativo'))
  })

  it.each([
    [0, 'Sem chuva'],
    [0.1, 'Até 5 mm'],
    [4.9, 'Até 5 mm'],
    [5, '5 a 25 mm'],
    [25, '25 a 50 mm'],
    [50, '50 mm ou mais'],
    [180, '50 mm ou mais'],
    [null, 'Sem leitura'],
  ])('chuva de %s mm cai na faixa "%s" (PR-031)', (mm, faixa) => {
    expect(corDaChuva(mm)).toBe(cor(LEGENDA_CHUVA, faixa))
  })

  it('pinta o ponto de risco pelo nível da Defesa Civil', () => {
    expect(corDoRisco(4)).toBe(cor(LEGENDA_RISCO, 'Nível 4'))
    expect(corDoRisco(1)).toBe(cor(LEGENDA_RISCO, 'Nível 1'))
    expect(corDoRisco(null)).toBe(LEGENDA_RISCO[4].cor)
    expect(rotuloDoRisco(3)).toBe('Nível 3')
    expect(rotuloDoRisco(null)).toBe('Sem nível')
  })

  it('soma a população do Recife só com todas as RPAs (PR-030)', () => {
    expect(populacaoTotal([rpa(73_764), rpa(372_982)])).toBe(446_746)
    expect(populacaoTotal([rpa(73_764), rpa(null)])).toBeNull()
    expect(populacaoTotal([])).toBeNull()
  })

  it('fonte sem coleta fica sem data, nunca a hora atual (RN-007 #2)', () => {
    const fontes = [{ fonte: 'openmeteo', ultima_atualizacao: '2026-11-21T10:00:00Z' }]

    expect(atualizacaoDaFonte(fontes, 'openmeteo')).toBe('2026-11-21T10:00:00Z')
    expect(atualizacaoDaFonte(fontes, 'ibge_populacao')).toBeNull()
  })

  it('enquadra os limites das RPAs, e null sem limite gravado', () => {
    const comLimite = (coordenadas: number[][]): RpaMapa => ({
      ...rpa(1),
      limite: { type: 'MultiPolygon', coordinates: [[coordenadas]] },
    })

    expect(
      enquadramento([
        comLimite([
          [-34.95, -8.15],
          [-34.9, -8.1],
        ]),
        comLimite([[-34.87, -7.93]]),
        rpa(1),
      ]),
    ).toEqual([
      [-8.15, -34.95],
      [-7.93, -34.87],
    ])
    expect(enquadramento([rpa(1)])).toBeNull()
  })

  it('lista as prioritárias na ordem da API e soma a população delas (RN-016)', () => {
    const rpas: RpaMapa[] = [
      { ...rpa(73_764), rpa: 1, prioridade: 2 },
      { ...rpa(220_000), rpa: 2 },
      { ...rpa(null), rpa: 3, prioridade: 3 },
      { ...rpa(372_982), rpa: 6, prioridade: 1 },
    ]

    expect(areasPrioritarias(rpas).map((r) => r.rpa)).toEqual([6, 1, 3])
    expect(pessoasEmRisco(rpas)).toBe(446_746)
    expect(pessoasEmRisco([rpa(100)])).toBe(0)
  })

  it('escreve a prioridade como ordinal, e travessão sem prioridade', () => {
    expect(rotuloDaPrioridade(1)).toBe('1ª')
    expect(rotuloDaPrioridade(null)).toBe('—')
  })
})
