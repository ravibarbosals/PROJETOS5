import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatarDataHoraCurta, formatarNumero } from '@/lib/format'
import { rotuloSituacao } from '@/modules/alertas/situacao'
import type { Alerta } from '@/modules/alertas/types'
import { rotuloVariavel } from '@/modules/leituras/variaveis'

interface AlertasTableProps {
  alertas: Alerta[]
  /** Abre o detalhe do alerta (1ª leitura, fonte, escalonamento, encerramento). */
  onDetalhar: (alerta: Alerta) => void
  /** Com a função, os ativos ganham o botão de ação manual (PER-014, PER-015). */
  onAgir?: (alerta: Alerta) => void
}

// Lista enxuta (escolha do usuário na TASK-067): o máximo do incidente contra o
// limiar do nível atual (RN-012 #4, #5) e a situação numa linha. Fonte e hora da
// leitura (REQ-005 #2, REQ-019) ficam no detalhe, aberto ao clicar na linha.
export function AlertasTable({ alertas, onDetalhar, onAgir }: AlertasTableProps) {
  // Hora da montagem da tabela: a lista é recarregada a cada ação ou atualização.
  const [agora] = useState(() => Date.now())
  const comAcoes = !!onAgir && alertas.some((a) => a.status === 'ATIVO')
  const colunas = comAcoes ? 7 : 6

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nível</TableHead>
          <TableHead>Variável</TableHead>
          <TableHead>Território</TableHead>
          <TableHead className="text-right">Máximo / limiar</TableHead>
          <TableHead>Disparado</TableHead>
          <TableHead>Situação</TableHead>
          {comAcoes && <TableHead className="text-right">Ações</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {alertas.length === 0 && (
          <TableRow>
            <TableCell colSpan={colunas} className="text-center text-muted-foreground">
              Nenhum alerta encontrado.
            </TableCell>
          </TableRow>
        )}
        {alertas.map((alerta) => (
          <TableRow
            key={alerta.id}
            tabIndex={0}
            aria-label={`Detalhes do alerta #${alerta.id}`}
            className="cursor-pointer"
            onClick={() => onDetalhar(alerta)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onDetalhar(alerta)
              }
            }}
          >
            <TableCell>
              <Badge variant="secondary">{alerta.nivel}</Badge>
            </TableCell>
            <TableCell>{rotuloVariavel(alerta.parametro.variavel)}</TableCell>
            <TableCell>{alerta.territorio}</TableCell>
            <TableCell className="text-right tabular-nums">
              <span className="font-medium">{formatarNumero(alerta.valor_maximo)}</span>
              <span className="text-muted-foreground"> / {formatarNumero(alerta.parametro.limiar)}</span>
            </TableCell>
            <TableCell className="tabular-nums">{formatarDataHoraCurta(alerta.disparado_em)}</TableCell>
            <TableCell>
              <Badge variant={alerta.status === 'ATIVO' ? 'destructive' : 'outline'}>
                {rotuloSituacao(alerta, agora)}
              </Badge>
            </TableCell>
            {comAcoes && (
              <TableCell className="text-right">
                {alerta.status === 'ATIVO' && (
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={`Agir sobre o alerta #${alerta.id}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      onAgir(alerta)
                    }}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    Agir
                  </Button>
                )}
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
