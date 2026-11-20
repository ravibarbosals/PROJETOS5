import { describe, expect, it } from 'vitest'
import { rotuloSituacao } from '@/modules/alertas/situacao'
import type { Alerta } from '@/modules/alertas/types'

const AGORA = Date.parse('2026-10-24T15:00:00Z')

const ativo: Alerta = {
  id: 10,
  nivel: 'ALTO',
  parametro: { id: 3, variavel: 'precipitacao_mm', limiar: 50 },
  territorio: 'Recife',
  valor_lido: 62.5,
  valor_maximo: 62.5,
  fonte: 'openmeteo',
  lida_em: '2026-10-24T13:00:00Z',
  ultima_leitura_em: '2026-10-24T13:00:00Z',
  disparado_em: '2026-10-24T13:05:00Z',
  escalonado_em: null,
  fonte_atualizada_em: null,
  status: 'ATIVO',
  prorrogado_ate: null,
  encerrado_em: null,
  motivo_encerramento: null,
}

describe('rotuloSituacao (RN-015)', () => {
  it('diz se o ativo está prorrogado, só enquanto o prazo vale', () => {
    expect(rotuloSituacao(ativo, AGORA)).toBe('Ativo')
    expect(rotuloSituacao({ ...ativo, prorrogado_ate: '2026-10-24T18:00:00Z' }, AGORA)).toBe(
      'Ativo · prorrogado',
    )
    expect(rotuloSituacao({ ...ativo, prorrogado_ate: '2026-10-24T14:00:00Z' }, AGORA)).toBe(
      'Ativo',
    )
  })

  it('mostra como o encerrado terminou', () => {
    const encerrado = { ...ativo, status: 'ENCERRADO' as const, encerrado_em: '2026-10-24T14:00:00Z' }
    expect(rotuloSituacao({ ...encerrado, motivo_encerramento: 'INVALIDADO' }, AGORA)).toBe(
      'Invalidado',
    )
    expect(rotuloSituacao({ ...encerrado, motivo_encerramento: null }, AGORA)).toBe('Encerrado')
  })
})
