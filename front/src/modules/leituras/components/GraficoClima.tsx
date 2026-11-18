import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import type { PontoDoGrafico } from '@/modules/leituras/resumo'

// Cores pelas variáveis de tema (DEC-028).
const config = {
  chuva: { label: 'Chuva (mm)', color: 'var(--chart-1)' },
  temperatura: { label: 'Temperatura (°C)', color: 'var(--chart-2)' },
} satisfies ChartConfig

// Chuva em barras (eixo da esquerda) e temperatura em linha (eixo da direita).
export function GraficoClima({ pontos }: { pontos: PontoDoGrafico[] }) {
  return (
    <ChartContainer config={config} className="aspect-auto h-72 w-full">
      <ComposedChart data={pontos} margin={{ left: 0, right: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="rotulo" tickLine={false} axisLine={false} minTickGap={24} />
        <YAxis yAxisId="chuva" tickLine={false} axisLine={false} width={32} />
        <YAxis
          yAxisId="temperatura"
          orientation="right"
          tickLine={false}
          axisLine={false}
          width={32}
          domain={['dataMin - 1', 'dataMax + 1']}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar yAxisId="chuva" dataKey="chuva" fill="var(--color-chuva)" radius={[3, 3, 0, 0]} />
        <Line
          yAxisId="temperatura"
          dataKey="temperatura"
          stroke="var(--color-temperatura)"
          strokeWidth={2}
          dot={false}
          connectNulls
        />
      </ComposedChart>
    </ChartContainer>
  )
}