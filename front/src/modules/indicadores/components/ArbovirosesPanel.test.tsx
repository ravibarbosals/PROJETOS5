import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ArbovirosesPanel } from '@/modules/indicadores/components/ArbovirosesPanel'
import { listarIndicadores } from '@/modules/indicadores/service/indicadores.service'
import type { IndicadorTerritorio } from '@/modules/indicadores/types'
import { renderWithQuery } from '@/test/render'

vi.mock('@/modules/indicadores/service/indicadores.service', () => ({
  listarIndicadores: vi.fn(),
  consultarTempoAcionamento: vi.fn(),
}))

const listarMock = vi.mocked(listarIndicadores)

const item = (bairro: string, periodo: string, valor: number): IndicadorTerritorio => ({
  territorio: 'Recife',
  bairro,
  indicador: 'dengue',
  periodo,
  valor,
  fonte: 'recife_arboviroses',
  fonte_atualizada_em: '2026-11-19T14:30:00Z',
})

const de2025 = [
  item('COHAB', '2025-SE01', 1200),
  item('IBURA', '2025-SE02', 3),
  item('IBURA', '2025-SE01', 2),
]

const cartao = (rotulo: string) => screen.getByText(rotulo).closest('div')!.parentElement!

describe('ArbovirosesPanel (REQ-008, DEC-031)', () => {
  beforeEach(() => {
    listarMock.mockReset()
    listarMock.mockImplementation((filtros) =>
      Promise.resolve(filtros.ano === 2024 ? [item('PINA', '2024-SE30', 7)] : de2025),
    )
  })

  it('começa pela dengue no último ano publicado, com os cartões', async () => {
    renderWithQuery(<ArbovirosesPanel />)

    await screen.findByText('Casos no ano')
    expect(listarMock).toHaveBeenCalledWith({ indicador: 'dengue' })
    expect(within(cartao('Casos no ano')).getByText('1.205')).toBeInTheDocument()
    expect(within(cartao('Última semana publicada')).getByText('SE02')).toBeInTheDocument()
    expect(within(cartao('Última semana publicada')).getByText('3 casos')).toBeInTheDocument()
    expect(within(cartao('Bairro com mais casos')).getByText('COHAB')).toBeInTheDocument()
  })

  it('mostra a fonte com a data no horário do Recife e o aviso do atraso (RN-007)', async () => {
    renderWithQuery(<ArbovirosesPanel />)

    expect(
      await screen.findByText('Fonte: Dados Abertos do Recife · atualizada em 19/11/2026 11:30'),
    ).toBeInTheDocument()
    expect(screen.getByText(/o ano mais recente publicado é 2025/)).toBeInTheDocument()
  })

  it('lista os bairros com mais casos em ordem', async () => {
    renderWithQuery(<ArbovirosesPanel />)

    const ranking = await screen.findByRole('list', { name: 'Bairros com mais casos' })
    const linhas = within(ranking).getAllByRole('listitem')
    expect(linhas.map((l) => l.textContent)).toEqual(['COHAB1.200', 'IBURA5'])
  })

  it('consulta de novo ao trocar o agravo e o ano', async () => {
    renderWithQuery(<ArbovirosesPanel />)
    await screen.findByText('Casos no ano')

    await userEvent.click(screen.getByRole('tab', { name: 'Zika' }))
    expect(listarMock).toHaveBeenLastCalledWith({ indicador: 'zika' })

    await userEvent.selectOptions(screen.getByLabelText('Ano'), '2024')
    expect(listarMock).toHaveBeenLastCalledWith({ indicador: 'zika', ano: 2024 })
    expect(
      await within(cartao('Bairro com mais casos')).findByText('PINA'),
    ).toBeInTheDocument()
  })

  it('sem casos publicados: avisa e não inventa valores nem data (RN-007 #2)', async () => {
    listarMock.mockResolvedValue([])
    renderWithQuery(<ArbovirosesPanel />)

    expect(await screen.findByText('Nenhum caso publicado para este agravo.')).toBeInTheDocument()
    expect(
      screen.getByText('Fonte: Dados Abertos do Recife · sem informação de atualização'),
    ).toBeInTheDocument()
    expect(within(cartao('Casos no ano')).getByText('—')).toBeInTheDocument()
    expect(screen.queryByLabelText('Ano')).not.toBeInTheDocument()
  })
})