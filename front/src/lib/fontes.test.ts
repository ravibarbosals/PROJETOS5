import { describe, expect, it } from 'vitest'
import { exigeAtribuicaoCemaden, nomeDaFonte } from '@/lib/fontes'

describe('nomeDaFonte', () => {
  it('dá o nome das fontes conhecidas e mantém o técnico das outras', () => {
    expect(nomeDaFonte('openmeteo')).toBe('Open-Meteo (modelo meteorológico)')
    expect(nomeDaFonte('cemaden')).toBe('Cemaden (pluviômetros)')
    expect(nomeDaFonte('APAC')).toBe('APAC')
  })
})

describe('exigeAtribuicaoCemaden (DEC-036)', () => {
  it('só quando algum dado mostrado é do Cemaden', () => {
    expect(exigeAtribuicaoCemaden(['openmeteo', 'cemaden'])).toBe(true)
    expect(exigeAtribuicaoCemaden(['openmeteo'])).toBe(false)
  })
})
