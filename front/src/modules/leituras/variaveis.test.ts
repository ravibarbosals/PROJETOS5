import { describe, expect, it } from 'vitest'
import { VARIAVEIS, rotuloVariavel } from '@/modules/leituras/variaveis'

describe('rotuloVariavel (DEC-033)', () => {
  it('dá nome legível às variáveis do gold', () => {
    expect(VARIAVEIS.map(rotuloVariavel)).toEqual([
      'Chuva (mm)',
      'Temperatura (°C)',
      'Umidade (%)',
      'Pressão (hPa)',
    ])
  })

  it('mostra o nome técnico de uma variável desconhecida', () => {
    expect(rotuloVariavel('chuva_1h')).toBe('chuva_1h')
  })
})
