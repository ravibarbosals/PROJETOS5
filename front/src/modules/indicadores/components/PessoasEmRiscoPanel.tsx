import { Users } from 'lucide-react'
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
import { formatarNumero } from '@/lib/format'
import { areasPrioritarias, pessoasEmRisco, rotuloDaPrioridade } from '@/modules/mapa/camadas'
import { useMapaQuery } from '@/modules/mapa/hooks/useMapa'
import type { Mapa } from '@/modules/mapa/types'

// REQ-010 / RN-016 #4: pessoas em risco = população residente das áreas
// prioritárias (RPAs com alerta ativo, PR-032), a partir do GET /mapa
// (PER-011).
export function PessoasEmRiscoPanel() {
  const query = useMapaQuery()

  return (
    <section className="grid content-start gap-4" aria-labelledby="titulo-pessoas-em-risco">
      <h2 id="titulo-pessoas-em-risco" className="text-lg font-semibold">
        Pessoas em risco
      </h2>
      <QueryResult query={query}>{(mapa) => <Resumo mapa={mapa} />}</QueryResult>
    </section>
  )
}

function Resumo({ mapa }: { mapa: Mapa }) {
  const prioritarias = areasPrioritarias(mapa.rpas)

  return (
    <>
      <StatCard
        icon={Users}
        label="População residente nas áreas prioritárias"
        value={formatarNumero(pessoasEmRisco(mapa.rpas))}
        hint="RPAs com alerta ativo; Censo 2022 (IBGE). Nem todo morador está em área de risco."
      />
      <Table aria-label="Áreas prioritárias">
        <TableHeader>
          <TableRow>
            <TableHead>Prioridade</TableHead>
            <TableHead>RPA</TableHead>
            <TableHead>Alerta</TableHead>
            <TableHead className="text-right">População residente</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {prioritarias.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                Nenhuma RPA com alerta ativo.
              </TableCell>
            </TableRow>
          )}
          {prioritarias.map((rpa) => (
            <TableRow key={rpa.rpa}>
              <TableCell>{rotuloDaPrioridade(rpa.prioridade)}</TableCell>
              <TableCell className="font-medium">{rpa.nome}</TableCell>
              <TableCell>
                <Badge variant="secondary">{rpa.alerta_nivel}</Badge>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {rpa.populacao === null ? '—' : formatarNumero(rpa.populacao)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="text-xs text-muted-foreground">
        Alerta do Recife inteiro não torna uma RPA prioritária, porque não diz onde aconteceu.
      </p>
    </>
  )
}
