import { useId, useState, type FormEvent } from 'react'
import { ArrowRight, Eye, EyeOff, Lock, Mail } from 'lucide-react'
import { ErrorAlert } from '@/components/ErrorAlert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiErrorStatus, describeApiError } from '@/lib/http'
import { lembrarEmail, lerEmailLembrado } from '@/modules/auth/email-lembrado'
import { useLoginMutation } from '@/modules/auth/hooks/useAuth'
import type { Usuario } from '@/modules/auth/types'

interface LoginFormProps {
  onSuccess: (usuario: Usuario) => void
}

function mensagemDeErro(error: unknown): string {
  const status = apiErrorStatus(error)
  // FLX-001: mensagem única para e-mail inexistente, senha errada e usuário inativo.
  if (status === 401) return 'E-mail ou senha inválidos'
  return describeApiError(error)
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const [email, setEmail] = useState(lerEmailLembrado)
  const [senha, setSenha] = useState('')
  const [lembrar, setLembrar] = useState(() => lerEmailLembrado() !== '')
  const [senhaVisivel, setSenhaVisivel] = useState(false)
  const loginMutation = useLoginMutation()
  const id = useId()

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const emailLimpo = email.trim()
    loginMutation.mutate(
      { email: emailLimpo, senha },
      {
        onSuccess: ({ usuario }) => {
          lembrarEmail(lembrar ? emailLimpo : null)
          onSuccess(usuario)
        },
      },
    )
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-5" noValidate>
      <div className="grid gap-2">
        <Label htmlFor={`${id}-email`}>E-mail</Label>
        <div className="relative">
          <Mail
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id={`${id}-email`}
            type="email"
            autoComplete="username"
            placeholder="nome@recife.pe.gov.br"
            required
            className="h-10 pl-9"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`${id}-senha`}>Senha</Label>
        <div className="relative">
          <Lock
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id={`${id}-senha`}
            type={senhaVisivel ? 'text' : 'password'}
            autoComplete="current-password"
            required
            className="h-10 pr-10 pl-9"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
          <button
            type="button"
            className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            aria-label={senhaVisivel ? 'Ocultar senha' : 'Mostrar senha'}
            aria-pressed={senhaVisivel}
            onClick={() => setSenhaVisivel((v) => !v)}
          >
            {senhaVisivel ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className="flex items-center gap-2">
          <Checkbox
            id={`${id}-lembrar`}
            checked={lembrar}
            onCheckedChange={(marcado) => setLembrar(marcado === true)}
          />
          <Label htmlFor={`${id}-lembrar`} className="font-normal">
            Lembrar meu e-mail
          </Label>
        </div>
        {/* PR-020: quem redefine a senha é o administrador */}
        <span className="text-muted-foreground">Esqueceu a senha? Fale com o administrador.</span>
      </div>

      {loginMutation.isError && <ErrorAlert>{mensagemDeErro(loginMutation.error)}</ErrorAlert>}

      <Button
        type="submit"
        size="lg"
        className="h-10"
        disabled={loginMutation.isPending || !email || !senha}
      >
        {loginMutation.isPending ? 'Entrando...' : 'Entrar'}
        {!loginMutation.isPending && <ArrowRight aria-hidden />}
      </Button>
    </form>
  )
}
