import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MapaRiscoPanel } from '@/modules/mapa/components/MapaRiscoPanel'
import { consultarMapa } from '@/modules/mapa/service/mapa.service'
import type { Mapa, RpaMapa } from '@/modules/mapa/types'
import { renderWithQuery } from '@/test/render'

vi.mock('@/modules/mapa/service/mapa.service', () => ({ consultarMapa: vi.fn() }))

// O Leaflet precisa de um navegador de verdade; aqui basta saber o que ele
// recebeu
vi.mock('@/modules/mapa/components/MapaLeaflet', () => ({
  MapaLeaflet: (props: { camada: string; mostrarAreas: boolean; areas: unknown[] }) => (
    <div
      data-testid="mapa-leaflet"
      data-camada={props.camada}
      data-areas={props.mostrarAreas ? props.areas.length : 0}
    />
  ),
}))

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

const mapa: Mapa = {
  rpas: [
    rpa(1, 'RPA 1 - Centro', { populacao: 73_764, chuva_24h_mm: 0.3 }),
    rpa(6, 'RPA 6 - Sul', {
      populacao: 372_982,
      chuva_24h_mm: 12.4,
      alerta_nivel: 'ALTO',
      prioridade: 1,
    }),
  ],
  areas_risco: [
    {
      id: 1,
      territorio: 'RPA 6 - Sul',
      bairro: 'JORDAO',
      localidade: 'Lagoa Encantada',
      endereco: 'Rua Doutor Cézar Montezuma 46',
      descricao: 'Área de Risco Nível 3',
      nivel: 3,
      latitude: -8.128689,
      longitude: -34.950349,
    },
  ],
  fontes: [{ fonte: 'cemaden', ultima_atualizacao: '2026-11-21T13:00:00Z' }],
}

describe('MapaRiscoPanel (REQ-008, DEC-038)', () => {
  beforeEach(() => {
    consultarMock.mockReset().mockResolvedValue(mapa)
  })

  it('começa pela camada de alerta, com os pontos de risco', async () => {
    renderWithQuery(<MapaRiscoPanel />)

    const leaflet = await screen.findByTestId('mapa-leaflet')
    expect(leaflet).toHaveAttribute('data-camada', 'alerta')
    expect(leaflet).toHaveAttribute('data-areas', '1')
    expect(screen.getByRole('list', { name: 'Alerta ativo na RPA' })).toBeInTheDocument()
  })

  it('troca para a chuva e esconde os pontos de risco', async () => {
    renderWithQuery(<MapaRiscoPanel />)
    await screen.findByTestId('mapa-leaflet')

    await userEvent.click(screen.getByRole('tab', { name: 'Chuva 24 h' }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'Pontos de área de risco' }))

    const leaflet = screen.getByTestId('mapa-leaflet')
    expect(leaflet).toHaveAttribute('data-camada', 'chuva')
    expect(leaflet).toHaveAttribute('data-areas', '0')
    expect(screen.getByRole('list', { name: 'Chuva acumulada em 24 h' })).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Pontos de área de risco' })).toBeNull()
  })

  it('resume cada RPA, com a prioridade (RN-016), e soma a população do Recife (PR-030)', async () => {
    renderWithQuery(<MapaRiscoPanel />)

    const tabela = await screen.findByRole('table', { name: 'Resumo por RPA' })
    const linhas = within(tabela).getAllByRole('row').map((l) => l.textContent)
    expect(linhas).toEqual([
      'RPAPopulação residenteChuva 24 hAlerta ativoPrioridade',
      'RPA 1 - Centro73.7640,3 mmNenhum—',
      'RPA 6 - Sul372.98212,4 mmALTO1ª',
      'Recife446.746',
    ])
  })

  it('avisa que só a Regional Sul tem áreas de risco publicadas', async () => {
    renderWithQuery(<MapaRiscoPanel />)

    expect(
      await screen.findByText(/só as áreas de risco da Regional Sul \(RPA 6\): 1 ponto\./),
    ).toBeInTheDocument()
  })

  it('mostra a data de cada fonte, e "sem informação" sem coleta (RN-007)', async () => {
    renderWithQuery(<MapaRiscoPanel />)

    const fontes = await screen.findByRole('list', { name: 'Fontes do mapa' })
    expect(
      within(fontes).getByText('Chuva: pluviômetros do Cemaden · atualizada em 21/11/2026 10:00'),
    ).toBeInTheDocument()
    expect(
      within(fontes).getByText('DADOS DA REDE OBSERVACIONAL DO CEMADEN/MCTIC'),
    ).toBeInTheDocument()
    expect(
      within(fontes).getByText('População: IBGE, Censo 2022 · sem informação de atualização'),
    ).toBeInTheDocument()
  })

  it('mostra o erro com "Tentar de novo"', async () => {
    consultarMock.mockRejectedValue(new Error('falhou'))
    renderWithQuery(<MapaRiscoPanel />)

    expect(await screen.findByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument()
  })
})
