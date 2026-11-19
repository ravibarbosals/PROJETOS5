import { useState } from 'react'
import { Bug, CalendarDays, MapPin } from 'lucide-react'
import { QueryResult } from '@/components/QueryResult'
import { SelectField } from '@/components/SelectField'
import { StatCard } from '@/components/StatCard'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatarDataHora, formatarNumero } from '@/lib/format'
import {
  anoDosItens,
  anosDisponiveis,
  resumirArboviroses,
  rotuloSemana,
} from '@/modules/indicadores/arboviroses'
import { GraficoSemanas } from '@/modules/indicadores/components/GraficoSemanas'
import { useArbovirosesQuery } from '@/modules/indicadores/hooks/useIndicadores'
import type { Agravo, IndicadorTerritorio } from '@/modules/indicadores/types'

const AGRAVOS: { valor: Agravo; rotulo: string }[] = [
  { valor: 'dengue', rotulo: 'Dengue' },
  { valor: 'chikungunya', rotulo: 'Chikungunya' },
  { valor: 'zika', rotulo: 'Zika' },
]

// REQ-008 (parte epidemiológica, TASK-041): casos prováveis de arbovirose
// por semana e por bairro (DEC-031).
export function ArbovirosesPanel() {
  const [agravo, setAgravo] = useState<Agravo>('dengue')
  // null: o último ano publicado, que só a API sabe
  const [ano, setAno] = useState<number | null>(null)

  const ultimo = useArbovirosesQuery(agravo, null)
  const escolhido = useArbovirosesQuery(agravo, ano, ano !== null)
  const ultimoAno = ultimo.data ? anoDosItens(ultimo.data) : null

  return (
    <section className="grid gap-4" aria-labelledby="titulo-arboviroses">
      <div>
        <h2 id="titulo-arboviroses" className="text-lg font-semibold">
          Arboviroses · casos prováveis
        </h2>
        <p className="text-sm text-muted-foreground">
          Notificações menos as descartadas, por semana epidemiológica. O portal da Prefeitura
          publica com atraso{ultimoAno ? `: o ano mais recente publicado é ${ultimoAno}` : ''}.
        </p>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <Tabs value={agravo} onValueChange={(valor) => setAgravo(valor as Agravo)}>
          <TabsList aria-label="Agravo">
            {AGRAVOS.map((a) => (
              <TabsTrigger key={a.valor} value={a.valor}>
                {a.rotulo}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {ultimoAno && (
          <SelectField
            label="Ano"
            className="w-28"
            value={String(ano ?? ultimoAno)}
            onChange={(e) => {
              const valor = Number(e.target.value)
              setAno(valor === ultimoAno ? null : valor)
            }}
            options={anosDisponiveis(ultimoAno).map((a) => ({
              valor: String(a),
              rotulo: String(a),
            }))}
          />
        )}
      </div>

      <QueryResult query={ano === null ? ultimo : escolhido}>
        {(itens) => <Painel itens={itens} />}
      </QueryResult>
    </section>
  )
}

const casos = (valor: number) => `${formatarNumero(valor)} ${valor === 1 ? 'caso' : 'casos'}`

function Painel({ itens }: { itens: IndicadorTerritorio[] }) {
  const resumo = resumirArboviroses(itens)
  const ano = anoDosItens(itens)
  const atualizadaEm = itens[0]?.fonte_atualizada_em ?? null
  const maior = resumo.ranking[0]?.valor ?? 0

  return (
    <>
      {/* RN-007: nunca a hora atual quando a data da fonte é desconhecida. */}
      <p className="text-sm text-muted-foreground">
        Fonte: Dados Abertos do Recife ·{' '}
        {atualizadaEm
          ? `atualizada em ${formatarDataHora(atualizadaEm)}`
          : 'sem informação de atualização'}
      </p>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={Bug}
          label="Casos no ano"
          value={ano === null ? '—' : formatarNumero(resumo.total)}
          hint={ano === null ? 'Sem casos publicados' : String(ano)}
        />
        <StatCard
          icon={CalendarDays}
          label="Última semana publicada"
          value={resumo.ultimaSemana ? rotuloSemana(resumo.ultimaSemana.chave) : '—'}
          hint={resumo.ultimaSemana ? casos(resumo.ultimaSemana.valor) : undefined}
        />
        <StatCard
          icon={MapPin}
          label="Bairro com mais casos"
          value={resumo.bairroComMaisCasos?.chave ?? '—'}
          hint={resumo.bairroComMaisCasos ? casos(resumo.bairroComMaisCasos.valor) : undefined}
        />
      </div>

      {itens.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum caso publicado para este agravo.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border p-4 lg:col-span-2">
            <h3 className="mb-2 text-sm font-medium">Casos por semana epidemiológica (Recife)</h3>
            <GraficoSemanas semanas={resumo.porSemana} />
          </div>
          <div className="rounded-xl border p-4">
            <h3 className="mb-3 text-sm font-medium">Bairros com mais casos no ano</h3>
            <ol className="grid gap-2" aria-label="Bairros com mais casos">
              {resumo.ranking.map((b) => (
                <li key={b.chave} className="grid gap-1">
                  <div className="flex justify-between gap-2 text-sm">
                    <span className="truncate">{b.chave}</span>
                    <span className="font-medium tabular-nums">{formatarNumero(b.valor)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted">
                    <div
                      className="h-1.5 rounded-full bg-chart-1"
                      style={{ width: `${(b.valor / maior) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </>
  )
}