import { cleanup, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LoginForm } from '@/modules/auth/components/LoginForm'
import { login } from '@/modules/auth/service/auth.service'
import { getToken } from '@/modules/auth/session'
import type { Usuario } from '@/modules/auth/types'
import { apiError } from '@/test/api-error'
import { renderWithQuery } from '@/test/render'

vi.mock('@/modules/auth/service/auth.service', () => ({
  login: vi.fn(),
  getMe: vi.fn(),
}))

const loginMock = vi.mocked(login)

const usuario: Usuario = {
  id: 1,
  nome: 'Marcos Andrade',
  email: 'marcos@exemplo.gov.br',
  papeis: ['GES'],
  ativo: true,
}

function setup() {
  const onSuccess = vi.fn()
  const { client } = renderWithQuery(<LoginForm onSuccess={onSuccess} />)
  return { onSuccess, client }
}

async function preencherEEnviar(email = ' marcos@exemplo.gov.br ', senha = 'senha-forte-1') {
  await userEvent.type(screen.getByLabelText('E-mail'), email)
  await userEvent.type(screen.getByLabelText('Senha'), senha)
  await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
}

describe('LoginForm', () => {
  beforeEach(() => {
    loginMock.mockReset()
    localStorage.clear()
  })

  it('desabilita o botão até preencher e-mail e senha', () => {
    setup()
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeDisabled()
  })

  it('guarda o token, preenche o usuário atual e avisa o sucesso', async () => {
    loginMock.mockResolvedValue({ access_token: 'jwt', usuario })
    const { onSuccess, client } = setup()

    await preencherEEnviar()

    expect(loginMock.mock.calls[0]?.[0]).toEqual({
      email: 'marcos@exemplo.gov.br',
      senha: 'senha-forte-1',
    })
    expect(onSuccess).toHaveBeenCalledWith(usuario)
    expect(getToken()).toBe('jwt')
    expect(client.getQueryData(['auth', 'me'])).toEqual(usuario)
  })

  it('mostra a mensagem única do FLX-001 no 401', async () => {
    loginMock.mockRejectedValue(apiError(401))
    const { onSuccess } = setup()

    await preencherEEnviar()

    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha inválidos')
    expect(onSuccess).not.toHaveBeenCalled()
    expect(getToken()).toBeNull()
  })

  it('mostra a mensagem do campo no 422', async () => {
    loginMock.mockRejectedValue(
      apiError(422, {
        message: 'Dados inválidos',
        errors: [{ property: 'email', constraints: { isEmail: 'E-mail inválido' } }],
      }),
    )
    setup()

    await preencherEEnviar('nao-e-email')

    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail inválido')
  })

  it('avisa quando o servidor não responde', async () => {
    loginMock.mockRejectedValue(new AxiosError('Network Error'))
    setup()

    await preencherEEnviar()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível conectar ao servidor',
    )
  })

  it('mostra e oculta a senha', async () => {
    setup()
    const senha = screen.getByLabelText('Senha')
    expect(senha).toHaveAttribute('type', 'password')

    await userEvent.click(screen.getByRole('button', { name: 'Mostrar senha' }))
    expect(senha).toHaveAttribute('type', 'text')

    await userEvent.click(screen.getByRole('button', { name: 'Ocultar senha' }))
    expect(senha).toHaveAttribute('type', 'password')
  })

  it('lembra só o e-mail quando marcado, e o traz de volta', async () => {
    loginMock.mockResolvedValue({ access_token: 'jwt', usuario })
    const primeiro = setup()

    await userEvent.click(screen.getByLabelText('Lembrar meu e-mail'))
    await preencherEEnviar()

    expect(primeiro.onSuccess).toHaveBeenCalled()
    expect(Object.values(localStorage).join()).not.toContain('senha-forte-1')
    primeiro.client.clear()
    cleanup()
    setup()
    expect(screen.getByLabelText('E-mail')).toHaveValue('marcos@exemplo.gov.br')
    expect(screen.getByLabelText('Lembrar meu e-mail')).toBeChecked()
  })

  it('esquece o e-mail quando entra com a caixa desmarcada', async () => {
    localStorage.setItem('vigia.email-lembrado', 'antigo@exemplo.gov.br')
    loginMock.mockResolvedValue({ access_token: 'jwt', usuario })
    setup()

    await userEvent.click(screen.getByLabelText('Lembrar meu e-mail'))
    await userEvent.clear(screen.getByLabelText('E-mail'))
    await preencherEEnviar()

    expect(localStorage.getItem('vigia.email-lembrado')).toBeNull()
  })

  it('não oferece cadastro: a senha esquecida é com o administrador (PR-020)', () => {
    setup()

    expect(screen.queryByText(/criar conta/i)).toBeNull()
    expect(screen.getByText('Esqueceu a senha? Fale com o administrador.')).toBeInTheDocument()
  })
})
