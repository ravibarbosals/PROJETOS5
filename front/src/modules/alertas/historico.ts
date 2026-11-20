import { formatarNumero } from '@/lib/format'
import type { HistoricoParametro, OperacaoHistorico } from '@/modules/alertas/types'
import { rotuloVariavel } from '@/modules/leituras/variaveis'

export const ROTULO_OPERACAO: Record<OperacaoHistorico, string> = {
  CRIACAO: 'Criação',
  ALTERACAO: 'Alteração',
  INATIVACAO: 'Inativação',
}

const ROTULO_CAMPO: Record<string, string> = {
  variavel: 'Variável',
  territorio: 'Território',
  limiar: 'Limiar',
  limiar_saida: 'Limiar de saída',
  janela_horas: 'Janela (h)',
  nivel: 'Nível',
  ativo: 'Situação',
}

function formatarValor(valor: unknown, campo: string): string {
  if (valor === undefined || valor === null) return '—'
  if (typeof valor === 'boolean') return valor ? 'Ativo' : 'Inativo'
  if (typeof valor === 'number') return formatarNumero(valor)
  if (campo === 'variavel') return rotuloVariavel(String(valor))
  return String(valor)
}

// RN-001: "Limiar: 50 → 60" por campo; na criação, só o valor novo.
export function descreverMudancas({ valor_anterior, valor_novo }: HistoricoParametro): string[] {
  return Object.entries(valor_novo).map(([campo, novo]) => {
    const rotulo = ROTULO_CAMPO[campo] ?? campo
    if (!valor_anterior) return `${rotulo}: ${formatarValor(novo, campo)}`
    return `${rotulo}: ${formatarValor(valor_anterior[campo], campo)} → ${formatarValor(novo, campo)}`
  })
}
