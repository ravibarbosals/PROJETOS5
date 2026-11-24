import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PessoasEmRiscoPanel } from '@/modules/indicadores/components/PessoasEmRiscoPanel'
import { consultarMapa } from '@/modules/mapa/service/mapa.service'
import type { Mapa, RpaMapa } from '@/modules/mapa/types'
import { renderWithQuery } from '@/test/render'

vi.mock('@/modules/mapa/service/mapa.service', () => ({ consultarMapa: vi.fn() }))

const consultarMock = vi.mocked(consultarMapa)

const rpa = (numero: number, nome: string, extra: Partial<RpaMapa> = {}): RpaMapa => ({
  nome,
  rpa: numero,
  limite: null,
  populacao: 100_000,
  chuva_24h_mm: null,
  alerta_nivel: null,
  prioridade: null,
  ...extra,
})

const mapa = (rpas: RpaMapa[]): Mapa => ({ rpas, areas_risco: [], fontes: [] })

describe('PessoasEmRiscoPanel (REQ-010, RN-016)', () => {
  beforeEach(() => {
    consultarMock.mockReset()
  })

  it('soma a população das prioritárias e lista na ordem da prioridade', async () => {
    consultarMock.mockResolvedValue(
      mapa([
        rpa(1, 'RPA 1 - Centro', { populacao: 73_764, alerta_nivel: 'ALTO', prioridade: 2 }),
        rpa(2, 'RPA 2 - Norte', { populacao: 220_000 }),
        rpa(6, 'RPA 6 - Sul', { populacao: 372_982, alerta_nivel: 'MODERADO', prioridade: 1 }),
      ]),
    )
    renderWithQuery(<PessoasEmRiscoPanel />)

    expect(await screen.findByText('446.746', { selector: 'p' })).toBeInTheDocument()
    const tabela = screen.getByRole('table', { name: 'Áreas prioritárias' })
    const linhas = within(tabela).getAllByRole('row').map((l) => l.textContent)
    expect(linhas).toEqual([
      'PrioridadeRPAAlertaPopulação residente',
      '1ªRPA 6 - SulMODERADO372.982',
      '2ªRPA 1 - CentroALTO73.764',
    ])
  })

  it('sem RPA com alerta ativo, zero pessoas em risco', async () => {
    consultarMock.mockResolvedValue(mapa([rpa(1, 'RPA 1 - Centro')]))
    renderWithQuery(<PessoasEmRiscoPanel />)

    expect(await screen.findByText('Nenhuma RPA com alerta ativo.')).toBeInTheDocument()
    expect(screen.getByText('0', { selector: 'p' })).toBeInTheDocument()
  })

  it('mostra o erro com "Tentar de novo"', async () => {
    consultarMock.mockRejectedValue(new Error('falhou'))
    renderWithQuery(<PessoasEmRiscoPanel />)

    expect(await screen.findByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument()
  })
})
