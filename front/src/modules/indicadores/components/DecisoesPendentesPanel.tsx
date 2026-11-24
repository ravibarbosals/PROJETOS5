import { Hourglass } from 'lucide-react'
import { QueryResult } from '@/components/QueryResult'
import { StatCard } from '@/components/StatCard'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatarDataHora } from '@/lib/format'
import { useDecisoesPendentesQuery } from '@/modules/indicadores/hooks/useIndicadores'
import type { DecisoesPendentes } from '@/modules/indicadores/types'
import { rotuloVariavel } from '@/modules/leituras/variaveis'

// REQ-010 / PR-033: alertas ativos que ainda não têm nenhuma ação registrada,
// quem espera há mais tempo primeiro.
export function DecisoesPendentesPanel() {
  const query = useDecisoesPendentesQuery()

  return (
    <section className="grid content-start gap-4" aria-labelledby="titulo-decisoes-pendentes">
      <h2 id="titulo-decisoes-pendentes" className="text-lg font-semibold">
        Decisões pendentes
      </h2>
      <QueryResult query={query}>{(dados) => <Resumo dados={dados} />}</QueryResult>
    </section>
  )
}

function Resumo({ dados }: { dados: DecisoesPendentes }) {
  return (
    <>
      <StatCard
        icon={Hourglass}
        label="Alertas ativos sem ação registrada"
        value={String(dados.total)}
        hint="Saem daqui quando alguém registra a primeira ação"
      />
      <Table aria-label="Alertas sem ação">
        <TableHeader>
          <TableRow>
            <TableHead>Disparado em</TableHead>
            <TableHead>Nível</TableHead>
            <TableHead>Variável</TableHead>
            <TableHead>Território</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {dados.alertas.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                Nenhum alerta ativo esperando ação.
              </TableCell>
            </TableRow>
          )}
          {dados.alertas.map((alerta) => (
            <TableRow key={alerta.id}>
              <TableCell>{formatarDataHora(alerta.disparado_em)}</TableCell>
              <TableCell>
                <Badge variant="secondary">{alerta.nivel}</Badge>
              </TableCell>
              <TableCell>{rotuloVariavel(alerta.variavel)}</TableCell>
              <TableCell>{alerta.territorio}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  )
}
