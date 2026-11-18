import { createFileRoute } from '@tanstack/react-router'
import { exigirPapel } from '@/modules/auth/guards'
import { Estacao01Page } from '@/modules/leituras/components/Estacao01Page'

export const Route = createFileRoute('/_autenticado/estacoes/est-01')({
  beforeLoad: ({ context }) => exigirPapel(context.usuario, ['TEC']),
  component: Estacao01Page,
})