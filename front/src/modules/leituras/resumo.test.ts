import { describe, expect, it } from 'vitest'
import { resumirLeituras, serieDoGrafico, ultimaAtualizacao } from '@/modules/leituras/resumo'
import type { Leitura, Variavel } from '@/modules/leituras/types'

const leitura = (
  variavel: Variavel,
  valor: number,
  lida_em: string,
  fonte_atualizada_em: string | null = '2026-11-18T13:42:00Z',
): Leitura => ({
  fonte: 'openmeteo',
  estacao: 'recife',
  territorio: 'Recife',
  variavel,
  valor,
  lida_em,
  fonte_atualizada_em,
})

const leituras = [
  leitura('precipitacao_mm', 0.1, '2026-11-18T10:00:00Z'),
  leitura('precipitacao_mm', 0.2, '2026-11-18T12:00:00Z'),
  leitura('precipitacao_mm', 0.4, '2026-11-18T11:00:00Z'),
  leitura('temperatura_c', 30.7, '2026-11-18T11:00:00Z'),
  leitura('temperatura_c', 29.8, '2026-11-18T12:00:00Z'),
  leitura('umidade_pct', 80, '2026-11-18T11:00:00Z'),
  leitura('umidade_pct', 78, '2026-11-18T12:00:00Z'),
]

describe('resumirLeituras (PR-013)', () => {
  it('chuva da última hora, acumulada sem erro de arredondamento, máxima e umidade atual', () => {
    expect(resumirLeituras(leituras)).toEqual({
      chuvaUltimaHora: { valor: 0.2, lida_em: '2026-11-18T12:00:00Z' },
      chuvaAcumulada: 0.7,
      temperaturaMaxima: { valor: 30.7, lida_em: '2026-11-18T11:00:00Z' },
      umidadeAtual: { valor: 78, lida_em: '2026-11-18T12:00:00Z' },
    })
  })

  it('sem leituras, nenhum valor inventado', () => {
    expect(resumirLeituras([])).toEqual({
      chuvaUltimaHora: null,
      chuvaAcumulada: null,
      temperaturaMaxima: null,
      umidadeAtual: null,
    })
  })
})

describe('ultimaAtualizacao (RN-007)', () => {
  it('a mais recente entre as leituras', () => {
    expect(
      ultimaAtualizacao([
        leitura('umidade_pct', 1, '2026-11-18T10:00:00Z', '2026-11-18T10:05:00Z'),
        leitura('umidade_pct', 1, '2026-11-18T11:00:00Z', '2026-11-18T11:05:00Z'),
      ]),
    ).toBe('2026-11-18T11:05:00Z')
  })

  it('null quando nenhuma fonte tem data (#2)', () => {
    expect(ultimaAtualizacao([leitura('umidade_pct', 1, '2026-11-18T10:00:00Z', null)])).toBeNull()
  })
})

describe('serieDoGrafico (DEC-028)', () => {
  it('por hora, em ordem, no horário do Recife; ignora umidade e pressão', () => {
    expect(serieDoGrafico(leituras, '24h')).toEqual([
      { chave: '2026-11-18T10:00:00Z', rotulo: '18/11 07h', chuva: 0.1, temperatura: null },
      { chave: '2026-11-18T11:00:00Z', rotulo: '18/11 08h', chuva: 0.4, temperatura: 30.7 },
      { chave: '2026-11-18T12:00:00Z', rotulo: '18/11 09h', chuva: 0.2, temperatura: 29.8 },
    ])
  })

  it('em 30 dias agrupa por dia do Recife: chuva somada, temperatura máxima', () => {
    const virada = [
      // 01:00 UTC do dia 19 ainda é dia 18 no Recife (UTC-3)
      leitura('precipitacao_mm', 1.1, '2026-11-19T01:00:00Z'),
      leitura('temperatura_c', 31.2, '2026-11-19T01:00:00Z'),
      leitura('precipitacao_mm', 5, '2026-11-19T04:00:00Z'),
    ]

    expect(serieDoGrafico([...leituras, ...virada], '30d')).toEqual([
      { chave: '18/11', rotulo: '18/11', chuva: 1.8, temperatura: 31.2 },
      { chave: '19/11', rotulo: '19/11', chuva: 5, temperatura: null },
    ])
  })
})