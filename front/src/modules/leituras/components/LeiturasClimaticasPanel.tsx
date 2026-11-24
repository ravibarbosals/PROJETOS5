import { useState } from 'react'
import { CloudRain, Droplets, Thermometer, Umbrella } from 'lucide-react'
import { PeriodoTabs } from '@/components/PeriodoTabs'
import { QueryResult } from '@/components/QueryResult'
import { SelectField } from '@/components/SelectField'
import { StatCard } from '@/components/StatCard'
import { ATRIBUICAO_CEMADEN, exigeAtribuicaoCemaden, nomeDaFonte } from '@/lib/fontes'
import { formatarDataHora, formatarNumero } from '@/lib/format'
import { PERIODOS, type Periodo } from '@/lib/periodo'
import { GraficoClima } from '@/modules/leituras/components/GraficoClima'
import { useLeiturasQuery } from '@/modules/leituras/hooks/useLeituras'
import {
  resumirLeituras,
  serieDoGrafico,
  ultimaAtualizacao,
  type LeituraPontual,
} from '@/modules/leituras/resumo'
import type { Leitura } from '@/modules/leituras/types'
import { useNomesDeTerritorio } from '@/modules/territorios/hooks/useTerritorios'
import { TERRITORIO_PADRAO } from '@/modules/territorios/types'

// REQ-008 (parte meteorológica): cartões da PR-013 e gráfico do período, do
// Recife inteiro ou de uma RPA (DEC-035).
export function LeiturasClimaticasPanel() {
  const [periodo, setPeriodo] = useState<Periodo>('24h')
  const [territorio, setTerritorio] = useState(TERRITORIO_PADRAO)
  const territorios = useNomesDeTerritorio()
  const query = useLeiturasQuery(periodo, territorio)

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end gap-4">
        <PeriodoTabs value={periodo} onChange={setPeriodo} />
        <div className="w-56">
          <SelectField
            label="Território"
            value={territorio}
            onChange={(e) => setTerritorio(e.target.value)}
            options={territorios.map((t) => ({ valor: t, rotulo: t }))}
          />
        </div>
      </div>
      <QueryResult query={query}>
        {(leituras) => <Painel leituras={leituras} periodo={periodo} />}
      </QueryResult>
    </div>
  )
}

const valor = (leitura: LeituraPontual | null, unidade: string) =>
  leitura ? `${formatarNumero(leitura.valor)} ${unidade}` : '—'

const quando = (leitura: LeituraPontual | null) =>
  leitura ? formatarDataHora(leitura.lida_em) : 'Sem leitura no período'

function Painel({ leituras, periodo }: { leituras: Leitura[]; periodo: Periodo }) {
  const resumo = resumirLeituras(leituras)
  const atualizadaEm = ultimaAtualizacao(leituras)
  const rotuloPeriodo = PERIODOS.find((p) => p.valor === periodo)!.rotulo.toLowerCase()
  const fontes = [...new Set(leituras.map((l) => l.fonte))].sort()

  return (
    <>
      {/* RN-007: nunca a hora atual quando a data da fonte é desconhecida. */}
      <div className="grid gap-1 text-sm text-muted-foreground">
        <p>
          Fonte: {fontes.length > 0 ? fontes.map(nomeDaFonte).join(', ') : 'sem leituras'} ·{' '}
          {atualizadaEm
            ? `atualizada em ${formatarDataHora(atualizadaEm)}`
            : 'sem informação de atualização'}
        </p>
        {exigeAtribuicaoCemaden(fontes) && <p>{ATRIBUICAO_CEMADEN}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={CloudRain}
          label="Chuva na última hora"
          value={valor(resumo.chuvaUltimaHora, 'mm')}
          hint={quando(resumo.chuvaUltimaHora)}
        />
        <StatCard
          icon={Umbrella}
          label="Chuva acumulada"
          value={
            resumo.chuvaAcumulada === null ? '—' : `${formatarNumero(resumo.chuvaAcumulada)} mm`
          }
          hint={rotuloPeriodo}
        />
        <StatCard
          icon={Thermometer}
          label="Temperatura máxima"
          value={valor(resumo.temperaturaMaxima, '°C')}
          hint={quando(resumo.temperaturaMaxima)}
        />
        <StatCard
          icon={Droplets}
          label="Umidade atual"
          value={valor(resumo.umidadeAtual, '%')}
          hint={quando(resumo.umidadeAtual)}
        />
      </div>

      {leituras.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma leitura no período.</p>
      ) : (
        <div className="rounded-xl border p-4">
          <GraficoClima pontos={serieDoGrafico(leituras, periodo)} />
        </div>
      )}
    </>
  )
}
