import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LeiturasClimaticasPanel } from '@/modules/leituras/components/LeiturasClimaticasPanel'
import { listarLeituras } from '@/modules/leituras/service/leituras.service'
import type { Leitura } from '@/modules/leituras/types'
import { listarTerritorios } from '@/modules/territorios/service/territorios.service'
import { renderWithQuery } from '@/test/render'
import { TERRITORIOS } from '@/test/territorios'

vi.mock('@/modules/leituras/service/leituras.service', () => ({
  listarLeituras: vi.fn(),
}))

vi.mock('@/modules/territorios/service/territorios.service', () => ({
  listarTerritorios: vi.fn(),
}))

const listarMock = vi.mocked(listarLeituras)
const territoriosMock = vi.mocked(listarTerritorios)

const base = {
  fonte: 'openmeteo',
  estacao: 'recife',
  territorio: 'Recife',
  fonte_atualizada_em: '2026-11-18T13:42:00Z',
}

const leituras: Leitura[] = [
  { ...base, variavel: 'precipitacao_mm', valor: 0.4, lida_em: '2026-11-18T12:00:00Z' },
  { ...base, variavel: 'precipitacao_mm', valor: 1.2, lida_em: '2026-11-18T13:00:00Z' },
  { ...base, variavel: 'temperatura_c', valor: 30.7, lida_em: '2026-11-18T12:00:00Z' },
  { ...base, variavel: 'umidade_pct', valor: 78, lida_em: '2026-11-18T13:00:00Z' },
]

const cartao = (rotulo: string) => screen.getByText(rotulo).closest('div')!.parentElement!

describe('LeiturasClimaticasPanel (REQ-008, PR-013)', () => {
  beforeEach(() => {
    listarMock.mockReset()
    listarMock.mockResolvedValue(leituras)
    territoriosMock.mockReset()
    territoriosMock.mockResolvedValue(TERRITORIOS)
  })

  it('mostra os cartões da PR-013 no horário do Recife', async () => {
    renderWithQuery(<LeiturasClimaticasPanel />)

    await screen.findByText('Chuva na última hora')
    expect(within(cartao('Chuva na última hora')).getByText('1,2 mm')).toBeInTheDocument()
    expect(within(cartao('Chuva na última hora')).getByText('18/11/2026 10:00')).toBeInTheDocument()
    expect(within(cartao('Chuva acumulada')).getByText('1,6 mm')).toBeInTheDocument()
    expect(within(cartao('Temperatura máxima')).getByText('30,7 °C')).toBeInTheDocument()
    expect(within(cartao('Umidade atual')).getByText('78 %')).toBeInTheDocument()
  })

  it('mostra quando a fonte foi atualizada (RN-007)', async () => {
    renderWithQuery(<LeiturasClimaticasPanel />)

    expect(
      await screen.findByText('Fonte: Open-Meteo · atualizada em 18/11/2026 10:42'),
    ).toBeInTheDocument()
  })

  it('sem leituras: avisa e não inventa valores nem data (RN-007 #2)', async () => {
    listarMock.mockResolvedValue([])
    renderWithQuery(<LeiturasClimaticasPanel />)

    expect(await screen.findByText('Nenhuma leitura no período.')).toBeInTheDocument()
    expect(
      screen.getByText('Fonte: Open-Meteo · sem informação de atualização'),
    ).toBeInTheDocument()
    expect(within(cartao('Chuva acumulada')).getByText('—')).toBeInTheDocument()
  })

  it('começa em 24 h e consulta de novo ao trocar o período (PR-018)', async () => {
    renderWithQuery(<LeiturasClimaticasPanel />)
    await screen.findByText('Chuva na última hora')
    expect(listarMock).toHaveBeenLastCalledWith({ periodo: '24h', territorio: 'Recife' })

    await userEvent.click(screen.getByRole('tab', { name: '7 dias' }))

    expect(listarMock).toHaveBeenLastCalledWith({ periodo: '7d', territorio: 'Recife' })
  })

  it('começa no Recife e consulta a RPA escolhida (DEC-035)', async () => {
    renderWithQuery(<LeiturasClimaticasPanel />)
    const territorio = screen.getByLabelText('Território')
    await screen.findByRole('option', { name: 'RPA 6 - Sul' })
    expect(territorio).toHaveValue('Recife')

    await userEvent.selectOptions(territorio, 'RPA 6 - Sul')

    expect(listarMock).toHaveBeenLastCalledWith({ periodo: '24h', territorio: 'RPA 6 - Sul' })
  })

  it('sem o catálogo, ainda mostra o Recife', async () => {
    territoriosMock.mockRejectedValue(new Error('falhou'))
    renderWithQuery(<LeiturasClimaticasPanel />)

    await screen.findByText('Chuva na última hora')
    expect(
      within(screen.getByLabelText('Território'))
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Recife'])
  })

  it('com as RPAs, os cartões mostram a estação de mais chuva, sem somar as estações (DEC-034)', async () => {
    const chuva = (estacao: string, valor: number, lida_em: string): Leitura => ({
      ...base,
      estacao,
      variavel: 'precipitacao_mm',
      valor,
      lida_em,
    })
    listarMock.mockResolvedValue([
      chuva('rpa1', 3, '2026-11-18T12:00:00Z'),
      chuva('rpa6', 2, '2026-11-18T12:00:00Z'),
      chuva('rpa6', 4, '2026-11-18T13:00:00Z'),
    ])
    renderWithQuery(<LeiturasClimaticasPanel />)

    await screen.findByText('Chuva na última hora')
    expect(within(cartao('Chuva acumulada')).getByText('6 mm')).toBeInTheDocument()
    expect(within(cartao('Chuva na última hora')).getByText('4 mm')).toBeInTheDocument()
  })
})
