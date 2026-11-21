import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { Eye, ShieldCheck } from 'lucide-react'
import { rotaInicial } from '@/modules/auth/estacoes'
import { carregarUsuario } from '@/modules/auth/guards'
import { LoginForm } from '@/modules/auth/components/LoginForm'
import { PainelDaMarca } from '@/modules/auth/components/PainelDaMarca'
import { ApiStatus } from '@/modules/health/components/ApiStatus'

export const Route = createFileRoute('/login')({
  beforeLoad: async ({ context }) => {
    const usuario = await carregarUsuario(context.queryClient)
    const rota = usuario && rotaInicial(usuario.papeis)
    if (rota) throw redirect({ to: rota })
  },
  component: LoginPage,
})

// FLX-001. Sem cadastro: as contas são criadas pelo administrador (PER-003).
function LoginPage() {
  const navigate = useNavigate()

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <PainelDaMarca />

      <main className="relative flex flex-col bg-[radial-gradient(ellipse_at_top_right,rgba(21,93,252,0.06),transparent_45%)]">
        <div className="flex justify-end p-6">
          <span className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5 text-emerald-600" aria-hidden />
            Acesso restrito
          </span>
        </div>

        <div className="flex flex-1 items-center justify-center px-6 pb-16">
          <div className="w-full max-w-sm">
            {/* A marca some com o painel em telas estreitas; aqui ela volta */}
            <div className="mb-8 flex items-center gap-2 lg:hidden">
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Eye className="size-5" aria-hidden />
              </span>
              <span className="font-semibold">O Vigia · Sala de situação</span>
            </div>

            <h1 className="text-2xl font-semibold tracking-tight">Entre na sua conta</h1>
            <p className="mt-1 mb-8 text-sm text-muted-foreground">
              Use o e-mail e a senha cadastrados pelo administrador do sistema.
            </p>

            <LoginForm
              onSuccess={(usuario) => {
                const rota = rotaInicial(usuario.papeis)
                if (rota) void navigate({ to: rota })
              }}
            />

            <div className="mt-8 text-xs">
              <ApiStatus />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
