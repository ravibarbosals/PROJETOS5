import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Paginated } from '@/lib/pagination'
import { AlertasPanel } from '@/modules/alertas/components/AlertasPanel'
import { agirSobreAlerta, listarAlertas } from '@/modules/alertas/service/alertas.service'
import type { Alerta } from '@/modules/alertas/types'
import { apiError } from '@/test/api-error'
import { renderWithQuery } from '@/test/render'

vi.mock('@/modules/alertas/service/alertas.service', () => ({
  listarAlertas: vi.fn(),
  agirSobreAlerta: vi.fn(),
}))

const listarMock = vi.mocked(listarAlertas)
const agirMock = vi.mocked(agirSobreAlerta)

const alerta: Alerta = {
  id: 10,
  nivel: 'ALTO',
  parametro: { id: 3, variavel: 'chuva_1h', limiar: 50 },
  territorio: 'RPA-1',
  valor_lido: 62.5,
  fonte: 'APAC',
  lida_em: '2026-10-24T13:00:00Z',
  disparado_em: '2026-10-24T13:05:00Z',
  fonte_atualizada_em: null,
  status: 'ATIVO',
  prorrogado_ate: null,
  encerrado_em: null,
  motivo_encerramento: null,
}

const encerrado: Alerta = {
  ...alerta,
  id: 11,
  territorio: 'RPA-2',
  status: 'ENCERRADO',
  encerrado_em: '2026-10-24T20:00:00Z',
  motivo_encerramento: 'INVALIDADO',
}

const TODAS = ['encerrar', 'prorrogar', 'invalidar'] as const

function pagina(data: Alerta[]): Paginated<Alerta> {
  return { data, meta: { itemsPerPage: 20, totalItems: data.length, currentPage: 1, totalPages: 1 } }
}

describe('AlertasPanel (MOD-002, PR-009)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    listarMock.mockResolvedValue(pagina([alerta]))
  })

  it('mostra os ativos por padrão, com leitura, limiar e horários do Recife', async () => {
    renderWithQuery(<AlertasPanel />)

    const linha = (await screen.findByText('RPA-1')).closest('tr')!
    expect(within(linha).getByText('ALTO')).toBeInTheDocument()
    expect(within(linha).getByText('62,5')).toBeInTheDocument()
    expect(within(linha).getByText('/ 50')).toBeInTheDocument()
    expect(within(linha).getByText('24/10/2026 10:05')).toBeInTheDocument()
    expect(listarMock).toHaveBeenCalledWith({ page: 1, status: 'ATIVO' })
  })

  it('troca para o histórico de encerrados e para todos', async () => {
    renderWithQuery(<AlertasPanel />)
    await screen.findByText('RPA-1')

    await userEvent.click(screen.getByRole('tab', { name: 'Encerrados' }))
    expect(listarMock).toHaveBeenLastCalledWith({ page: 1, status: 'ENCERRADO' })

    await userEvent.click(screen.getByRole('tab', { name: 'Todos' }))
    expect(listarMock).toHaveBeenLastCalledWith({ page: 1, status: undefined })
  })

  it('avisa quando não há alertas', async () => {
    listarMock.mockResolvedValue(pagina([]))
    renderWithQuery(<AlertasPanel />)

    expect(await screen.findByText('Nenhum alerta encontrado.')).toBeInTheDocument()
  })

  it('mostra como o alerta encerrou e até quando foi prorrogado (RN-015)', async () => {
    listarMock.mockResolvedValue(
      pagina([{ ...alerta, prorrogado_ate: '2999-01-01T03:00:00Z' }, encerrado]),
    )
    renderWithQuery(<AlertasPanel />)

    const ativo = (await screen.findByText('RPA-1')).closest('tr')!
    expect(within(ativo).getByText('Prorrogado até 01/01/2999 00:00')).toBeInTheDocument()
    const fechado = screen.getByText('RPA-2').closest('tr')!
    expect(within(fechado).getByText('Invalidado · 24/10/2026 17:00')).toBeInTheDocument()
  })

  describe('ações manuais (PER-014, PER-015)', () => {
    async function abrir(acoes: readonly ('encerrar' | 'prorrogar' | 'invalidar')[] = TODAS) {
      renderWithQuery(<AlertasPanel acoes={[...acoes]} />)
      await userEvent.click(await screen.findByRole('button', { name: 'Agir sobre o alerta #10' }))
      return screen.getByRole('dialog')
    }

    it('sem ações permitidas, só consulta', async () => {
      renderWithQuery(<AlertasPanel />)

      await screen.findByText('RPA-1')
      expect(screen.queryByRole('button', { name: /Agir/ })).not.toBeInTheDocument()
    })

    it('oferece a ação só nos alertas ativos', async () => {
      listarMock.mockResolvedValue(pagina([alerta, encerrado]))
      renderWithQuery(<AlertasPanel acoes={[...TODAS]} />)

      await screen.findByText('RPA-1')
      expect(screen.getAllByRole('button', { name: /Agir sobre/ })).toHaveLength(1)
    })

    it('encerra com motivo de 10 caracteres ou mais, sem contar espaços (RN-015 #8)', async () => {
      agirMock.mockResolvedValue({ ...alerta, status: 'ENCERRADO' })
      const dialogo = await abrir()
      const confirmar = within(dialogo).getByRole('button', { name: 'Encerrar' })

      await userEvent.type(within(dialogo).getByLabelText('Motivo'), '  curto    ')
      expect(confirmar).toBeDisabled()

      await userEvent.type(within(dialogo).getByLabelText('Motivo'), 'chuva parou')
      await userEvent.click(confirmar)

      expect(agirMock).toHaveBeenCalledWith(10, 'encerrar', {
        motivo: 'curto    chuva parou',
      })
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    })

    it('prorroga com prazo inteiro de 1 a 24 horas (RN-015 #6)', async () => {
      agirMock.mockResolvedValue(alerta)
      const dialogo = await abrir()
      await userEvent.selectOptions(within(dialogo).getByLabelText('Ação'), 'prorrogar')
      await userEvent.type(within(dialogo).getByLabelText('Motivo'), 'Previsão de nova chuva forte')
      const prazo = within(dialogo).getByLabelText('Prazo (horas)')

      await userEvent.clear(prazo)
      await userEvent.type(prazo, '25')
      expect(within(dialogo).getByText('Inteiro de 1 a 24')).toBeInTheDocument()
      expect(within(dialogo).getByRole('button', { name: 'Prorrogar' })).toBeDisabled()

      await userEvent.clear(prazo)
      await userEvent.type(prazo, '6h')
      await userEvent.click(within(dialogo).getByRole('button', { name: 'Prorrogar' }))

      expect(agirMock).toHaveBeenCalledWith(10, 'prorrogar', {
        motivo: 'Previsão de nova chuva forte',
        horas: 6,
      })
    })

    it('invalida sem mandar prazo', async () => {
      agirMock.mockResolvedValue({ ...alerta, status: 'ENCERRADO' })
      const dialogo = await abrir()
      await userEvent.selectOptions(within(dialogo).getByLabelText('Ação'), 'invalidar')
      await userEvent.type(within(dialogo).getByLabelText('Motivo'), 'Falha pontual da fonte')
      expect(within(dialogo).queryByLabelText('Prazo (horas)')).not.toBeInTheDocument()
      await userEvent.click(within(dialogo).getByRole('button', { name: 'Invalidar' }))

      expect(agirMock).toHaveBeenCalledWith(10, 'invalidar', { motivo: 'Falha pontual da fonte' })
    })

    it('só lista as ações que o papel permite', async () => {
      const dialogo = await abrir(['encerrar', 'prorrogar'])
      const opcoes = within(within(dialogo).getByLabelText('Ação'))
        .getAllByRole('option')
        .map((o) => o.getAttribute('value'))

      expect(opcoes).toEqual(['encerrar', 'prorrogar'])
    })

    it('mostra o erro da API, como o alerta já encerrado pelo job (409)', async () => {
      agirMock.mockRejectedValue(
        apiError(409, { message: 'O alerta não está ativo', business_rule_code: 'ALERTA_NAO_ATIVO' }),
      )
      const dialogo = await abrir()
      await userEvent.type(within(dialogo).getByLabelText('Motivo'), 'Equipes confirmaram normalidade')
      await userEvent.click(within(dialogo).getByRole('button', { name: 'Encerrar' }))

      expect(await within(dialogo).findByText('O alerta não está ativo')).toBeInTheDocument()
    })
  })
})
