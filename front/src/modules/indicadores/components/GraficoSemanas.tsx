import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { formatarNumero } from '@/lib/format'
import { rotuloSemana, type TotalPorChave } from '@/modules/indicadores/arboviroses'

// Cores pelas variáveis de tema (DEC-028).
const config = {
  valor: { label: 'Casos prováveis:', color: 'var(--chart-1)' },
} satisfies ChartConfig

// Casos de Recife inteiro por semana epidemiológica (DEC-031). A altura
// acompanha a lista dos 10 bairros ao lado.
export function GraficoSemanas({ semanas }: { semanas: TotalPorChave[] }) {
  const pontos = semanas.map((s) => ({ semana: rotuloSemana(s.chave), valor: s.valor }))

  return (
    <ChartContainer config={config} className="aspect-auto h-80 w-full">
      <BarChart data={pontos} margin={{ left: 0, right: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="semana" tickLine={false} axisLine={false} minTickGap={16} />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={40}
          allowDecimals={false}
          tickFormatter={formatarNumero}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(valor) => (
                <span className="flex w-full justify-between gap-4">
                  <span className="text-muted-foreground">{config.valor.label}</span>
                  <span className="font-medium tabular-nums">{formatarNumero(Number(valor))}</span>
                </span>
              )}
            />
          }
        />
        <Bar dataKey="valor" fill="var(--color-valor)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ChartContainer>
  )
}