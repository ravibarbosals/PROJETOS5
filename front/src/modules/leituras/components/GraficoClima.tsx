import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { formatarNumero } from '@/lib/format'
import type { PontoDoGrafico } from '@/modules/leituras/resumo'

// Cores pelas variáveis de tema (DEC-028).
const config = {
  chuva: { label: 'Chuva (mm)', color: 'var(--chart-1)' },
  temperatura: { label: 'Temperatura (°C)', color: 'var(--chart-2)' },
} satisfies ChartConfig

// O eixo da chuva vai no mínimo até 1 mm: garoa de 0,1 mm não pode parecer temporal.
const CHUVA_MINIMA_DO_EIXO = 1

const eixoChuva = (maximo: number) => Math.max(CHUVA_MINIMA_DO_EIXO, Math.ceil(maximo))

// Graus inteiros com 1 °C de folga acima e abaixo.
const eixoTemperatura: [(min: number) => number, (max: number) => number] = [
  (min) => Math.floor(min) - 1,
  (max) => Math.ceil(max) + 1,
]

// Chuva em barras (eixo da esquerda) e temperatura em linha (eixo da direita).
export function GraficoClima({ pontos }: { pontos: PontoDoGrafico[] }) {
  return (
    <ChartContainer config={config} className="aspect-auto h-72 w-full">
      <ComposedChart data={pontos} margin={{ left: 0, right: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="rotulo" tickLine={false} axisLine={false} minTickGap={24} />
        <YAxis
          yAxisId="chuva"
          tickLine={false}
          axisLine={false}
          width={40}
          domain={[0, eixoChuva]}
          tickFormatter={formatarNumero}
        />
        <YAxis
          yAxisId="temperatura"
          orientation="right"
          tickLine={false}
          axisLine={false}
          width={40}
          domain={eixoTemperatura}
          allowDecimals={false}
          tickFormatter={formatarNumero}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(valor, nome) => (
                <span className="flex w-full justify-between gap-4">
                  <span className="text-muted-foreground">
                    {config[nome as keyof typeof config].label}
                  </span>
                  <span className="font-medium tabular-nums">{formatarNumero(Number(valor))}</span>
                </span>
              )}
            />
          }
        />
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