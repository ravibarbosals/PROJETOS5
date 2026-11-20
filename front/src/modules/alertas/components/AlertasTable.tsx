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
import { formatarDataHora, formatarNumero } from '@/lib/format'
import type { Alerta, MotivoEncerramento } from '@/modules/alertas/types'

// RN-015: como cada alerta terminou.
const ROTULO_MOTIVO: Record<MotivoEncerramento, string> = {
  NORMALIZADO: 'Normalizado',
  EXPIRADO: 'Expirado (sem leitura)',
  MANUAL: 'Encerrado manualmente',
  INVALIDADO: 'Invalidado',
}

interface AlertasTableProps {
  alertas: Alerta[]
  /** Com a função, os ativos ganham o botão de ação manual (PER-014, PER-015). */
  onAgir?: (alerta: Alerta) => void
}

// REQ-005 (2): fonte e hora da leitura. O destaque por cor de nível depende da
// escala (DUV-010); até lá o nível aparece como texto.
export function AlertasTable({ alertas, onAgir }: AlertasTableProps) {
  // Hora da montagem da tabela: a lista é recarregada a cada ação ou atualização.
  const [agora] = useState(() => Date.now())
  const colunas = onAgir ? 9 : 8

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nível</TableHead>
          <TableHead>Variável</TableHead>
          <TableHead>Território</TableHead>
          <TableHead className="text-right">Leitura / limiar</TableHead>
          <TableHead>Fonte</TableHead>
          <TableHead>Lida em</TableHead>
          <TableHead>Disparado em</TableHead>
          <TableHead>Situação</TableHead>
          {onAgir && <TableHead className="text-right">Ações</TableHead>}
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
          <TableRow key={alerta.id}>
            <TableCell>
              <Badge variant="secondary">{alerta.nivel}</Badge>
            </TableCell>
            <TableCell>{alerta.parametro.variavel}</TableCell>
            <TableCell>{alerta.territorio}</TableCell>
            <TableCell className="text-right tabular-nums">
              <span className="font-medium">{formatarNumero(alerta.valor_lido)}</span>
              <span className="text-muted-foreground"> / {formatarNumero(alerta.parametro.limiar)}</span>
            </TableCell>
            <TableCell>{alerta.fonte}</TableCell>
            <TableCell>{formatarDataHora(alerta.lida_em)}</TableCell>
            <TableCell>{formatarDataHora(alerta.disparado_em)}</TableCell>
            <TableCell>
              <Badge variant={alerta.status === 'ATIVO' ? 'destructive' : 'outline'}>
                {alerta.status === 'ATIVO' ? 'Ativo' : 'Encerrado'}
              </Badge>
              {alerta.status === 'ATIVO' &&
                alerta.prorrogado_ate &&
                new Date(alerta.prorrogado_ate).getTime() > agora && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Prorrogado até {formatarDataHora(alerta.prorrogado_ate)}
                  </p>
                )}
              {alerta.status === 'ENCERRADO' && alerta.motivo_encerramento && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {ROTULO_MOTIVO[alerta.motivo_encerramento]}
                  {alerta.encerrado_em && ` · ${formatarDataHora(alerta.encerrado_em)}`}
                </p>
              )}
            </TableCell>
            {onAgir && (
              <TableCell className="text-right">
                {alerta.status === 'ATIVO' && (
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={`Agir sobre o alerta #${alerta.id}`}
                    onClick={() => onAgir(alerta)}
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
