import { useState } from 'react'
import { CloudRain, Droplets, Thermometer, Umbrella } from 'lucide-react'
import { PeriodoTabs } from '@/components/PeriodoTabs'
import { QueryResult } from '@/components/QueryResult'
import { StatCard } from '@/components/StatCard'
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

// REQ-008 (parte meteorológica): cartões da PR-013 e gráfico do período.
export function LeiturasClimaticasPanel() {
  const [periodo, setPeriodo] = useState<Periodo>('24h')
  const query = useLeiturasQuery(periodo)

  return (
    <div className="grid gap-4">
      <PeriodoTabs value={periodo} onChange={setPeriodo} />
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

  return (
    <>
      {/* RN-007: nunca a hora atual quando a data da fonte é desconhecida. */}
      <p className="text-sm text-muted-foreground">
        Fonte: Open-Meteo ·{' '}
        {atualizadaEm
          ? `atualizada em ${formatarDataHora(atualizadaEm)}`
          : 'sem informação de atualização'}
      </p>

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