import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DecisoesPendentesPanel } from '@/modules/indicadores/components/DecisoesPendentesPanel'
import { consultarDecisoesPendentes } from '@/modules/indicadores/service/indicadores.service'
import { renderWithQuery } from '@/test/render'

vi.mock('@/modules/indicadores/service/indicadores.service', () => ({
  consultarDecisoesPendentes: vi.fn(),
}))

const consultarMock = vi.mocked(consultarDecisoesPendentes)

describe('DecisoesPendentesPanel (REQ-010, PR-033)', () => {
  beforeEach(() => {
    consultarMock.mockReset()
  })

  it('conta e lista os alertas ativos sem ação, na ordem da API', async () => {
    consultarMock.mockResolvedValue({
      total: 2,
      alertas: [
        {
          id: 3,
          variavel: 'precipitacao_mm',
          territorio: 'Recife',
          nivel: 'MODERADO',
          disparado_em: '2026-11-24T09:00:00Z',
        },
        {
          id: 7,
          variavel: 'temperatura_c',
          territorio: 'RPA 6 - Sul',
          nivel: 'ALTO',
          disparado_em: '2026-11-24T12:30:00Z',
        },
      ],
    })
    renderWithQuery(<DecisoesPendentesPanel />)

    expect(await screen.findByText('2', { selector: 'p' })).toBeInTheDocument()
    const tabela = screen.getByRole('table', { name: 'Alertas sem ação' })
    const linhas = within(tabela)
      .getAllByRole('row')
      .slice(1)
      .map((l) => l.textContent)
    expect(linhas).toEqual([
      '24/11/2026 06:00MODERADOChuva (mm)Recife',
      '24/11/2026 09:30ALTOTemperatura (°C)RPA 6 - Sul',
    ])
  })

  it('sem pendência, mostra zero e a lista vazia', async () => {
    consultarMock.mockResolvedValue({ total: 0, alertas: [] })
    renderWithQuery(<DecisoesPendentesPanel />)

    expect(await screen.findByText('Nenhum alerta ativo esperando ação.')).toBeInTheDocument()
    expect(screen.getByText('0', { selector: 'p' })).toBeInTheDocument()
  })
})
