import { describe, expect, it } from 'vitest'
  import {
    filtrarNumero,
    formatarDataHora,
    formatarDataHoraCurta,
    formatarDuracao,
    formatarNumero,
    lerNumero,
    numeroParaCampo,
  } from '@/lib/format'

  describe('format', () => {
    it('mostra a data UTC no horário do Recife (UTC−3)', () => {
      expect(formatarDataHora('2026-10-24T13:05:00Z')).toBe('24/10/2026 10:05')
    })

    it('tem a forma curta, sem o ano, para listas', () => {
      expect(formatarDataHoraCurta('2026-10-24T13:05:00Z')).toBe('24/10 10:05')
    })

    it('usa vírgula decimal e até 3 casas', () => {
      expect(formatarNumero(1234.5)).toBe('1.234,5')
      expect(formatarNumero(62.1234)).toBe('62,123')
    })
  })

  describe('lerNumero', () => {
    it.each([
      ['62,5', 62.5],
      ['1.234,5', 1234.5],
      ['-3', -3],
      [' 50 ', 50],
    ])('lê %j', (texto, valor) => {
      expect(lerNumero(texto)).toBe(valor)
    })

    it.each(['', 'abc', '1,2,3', '12a'])('recusa %j', (texto) => {
      expect(lerNumero(texto)).toBeNull()
    })
  })

  describe('filtrarNumero', () => {
    it('descarta letras e outros caracteres', () => {
      expect(filtrarNumero('3a7b')).toBe('37')
      expect(filtrarNumero('abc')).toBe('')
      expect(filtrarNumero('1 2%3')).toBe('123')
    })

    it('aceita uma vírgula decimal e troca o ponto por vírgula', () => {
      expect(filtrarNumero('30,5')).toBe('30,5')
      expect(filtrarNumero('30.5')).toBe('30,5')
      expect(filtrarNumero('3,0,5')).toBe('3,05')
    })

    it('limita as casas decimais (decimal(12,3) do banco)', () => {
      expect(filtrarNumero('1,23456')).toBe('1,234')
      expect(filtrarNumero('1,5', { casas: 0 })).toBe('15')
    })

    it('aceita o sinal só no início e só se permitido', () => {
      expect(filtrarNumero('-5')).toBe('-5')
      expect(filtrarNumero('5-')).toBe('5')
      expect(filtrarNumero('-5', { negativo: false })).toBe('5')
    })
  })

  describe('numeroParaCampo', () => {
    it('usa vírgula decimal e não põe separador de milhar', () => {
      expect(numeroParaCampo(1234.5)).toBe('1234,5')
      expect(numeroParaCampo(30)).toBe('30')
    })
  })

  describe('formatarDuracao', () => {
    it.each([
      [45, '45 s'],
      [60, '1 min'],
      [2280, '38 min'],
      [3600, '1 h 00 min'],
      [3900, '1 h 05 min'],
      [90061, '25 h 01 min'],
    ])('%i s → %s', (segundos, texto) => {
      expect(formatarDuracao(segundos)).toBe(texto)
    })
  })
