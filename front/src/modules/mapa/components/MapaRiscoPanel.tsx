import { lazy, Suspense, useId, useState } from 'react'
import { QueryResult } from '@/components/QueryResult'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ATRIBUICAO_CEMADEN } from '@/lib/fontes'
import { formatarDataHora, formatarNumero } from '@/lib/format'
import {
  atualizacaoDaFonte,
  corDaChuva,
  corDoAlerta,
  LEGENDA_ALERTA,
  LEGENDA_CHUVA,
  LEGENDA_RISCO,
  populacaoTotal,
  rotuloDaPrioridade,
  type ItemLegenda,
} from '@/modules/mapa/camadas'
import { useMapaQuery } from '@/modules/mapa/hooks/useMapa'
import type { CamadaRpa, Mapa } from '@/modules/mapa/types'

// O Leaflet só baixa quando o painel aparece
const MapaLeaflet = lazy(() =>
  import('@/modules/mapa/components/MapaLeaflet').then((m) => ({ default: m.MapaLeaflet })),
)

const CAMADAS: { valor: CamadaRpa; rotulo: string }[] = [
  { valor: 'alerta', rotulo: 'Alerta ativo' },
  { valor: 'chuva', rotulo: 'Chuva 24 h' },
]

const FONTES: { fonte: string; rotulo: string }[] = [
  { fonte: 'cemaden', rotulo: 'Chuva: pluviômetros do Cemaden' },
  { fonte: 'recife_areas_risco', rotulo: 'Áreas de risco: Defesa Civil do Recife' },
  { fonte: 'ibge_populacao', rotulo: 'População: IBGE, Censo 2022' },
  { fonte: 'recife_limites_rpa', rotulo: 'Limites: Prefeitura do Recife' },
]

// REQ-008, REQ-003, DEC-038 (TASK-064): as 6 RPAs pintadas pelo alerta ativo
// ou pela chuva de 24 h, com os pontos de área de risco da Defesa Civil. As
// áreas prioritárias (RN-016) aparecem destacadas (REQ-003 #2).
export function MapaRiscoPanel() {
  const [camada, setCamada] = useState<CamadaRpa>('alerta')
  const [mostrarAreas, setMostrarAreas] = useState(true)
  const idAreas = useId()
  const query = useMapaQuery()

  return (
    <section className="grid gap-4" aria-labelledby="titulo-mapa">
      <div>
        <h2 id="titulo-mapa" className="text-lg font-semibold">
          Mapa de risco por RPA
        </h2>
        <p className="text-sm text-muted-foreground">
          Alerta ativo ou chuva das últimas 24 h em cada RPA, com a população residente e os pontos
          de área de risco da Defesa Civil.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <Tabs value={camada} onValueChange={(valor) => setCamada(valor as CamadaRpa)}>
          <TabsList aria-label="Camada das RPAs">
            {CAMADAS.map((c) => (
              <TabsTrigger key={c.valor} value={c.valor}>
                {c.rotulo}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          <Checkbox
            id={idAreas}
            checked={mostrarAreas}
            onCheckedChange={(marcado) => setMostrarAreas(marcado === true)}
          />
          <Label htmlFor={idAreas} className="font-normal">
            Pontos de área de risco
          </Label>
        </div>
      </div>

      <QueryResult query={query}>
        {(mapa) => <Conteudo mapa={mapa} camada={camada} mostrarAreas={mostrarAreas} />}
      </QueryResult>
    </section>
  )
}

interface ConteudoProps {
  mapa: Mapa
  camada: CamadaRpa
  mostrarAreas: boolean
}

function Conteudo({ mapa, camada, mostrarAreas }: ConteudoProps) {
  const total = populacaoTotal(mapa.rpas)

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-3">
        {/* isolate: os painéis do Leaflet (z-index 400 a 1000) não passam por cima
            de dialogs e do cabeçalho */}
        <div className="isolate h-[480px] overflow-hidden rounded-xl border lg:col-span-2">
          <Suspense
            fallback={<p className="p-4 text-sm text-muted-foreground">Carregando o mapa...</p>}
          >
            <MapaLeaflet
              rpas={mapa.rpas}
              areas={mapa.areas_risco}
              camada={camada}
              mostrarAreas={mostrarAreas}
            />
          </Suspense>
        </div>
        <div className="grid content-start gap-4">
          <Legenda
            titulo={camada === 'alerta' ? 'Alerta ativo na RPA' : 'Chuva acumulada em 24 h'}
            itens={camada === 'alerta' ? LEGENDA_ALERTA : LEGENDA_CHUVA}
          />
          {camada === 'alerta' && (
            <p className="text-xs text-muted-foreground">
              Alerta do Recife inteiro não pinta uma RPA, porque não diz onde aconteceu.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Contorno grosso: área prioritária, uma RPA com alerta ativo. A ordem vai da maior para
            a menor população residente.
          </p>
          {mostrarAreas && <Legenda titulo="Pontos de área de risco" itens={LEGENDA_RISCO} />}
          <p className="text-xs text-muted-foreground">
            A Prefeitura publica só as áreas de risco da Regional Sul (RPA 6):{' '}
            {formatarNumero(mapa.areas_risco.length)}{' '}
            {mapa.areas_risco.length === 1 ? 'ponto' : 'pontos'}.
          </p>
        </div>
      </div>

      <div className="rounded-xl border">
        <Table aria-label="Resumo por RPA">
          <TableHeader>
            <TableRow>
              <TableHead>RPA</TableHead>
              <TableHead className="text-right">População residente</TableHead>
              <TableHead className="text-right">Chuva 24 h</TableHead>
              <TableHead>Alerta ativo</TableHead>
              <TableHead>Prioridade</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mapa.rpas.map((rpa) => (
              <TableRow key={rpa.rpa}>
                <TableCell className="font-medium">{rpa.nome}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {rpa.populacao === null ? '—' : formatarNumero(rpa.populacao)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  <Marcador cor={corDaChuva(rpa.chuva_24h_mm)} />
                  {rpa.chuva_24h_mm === null
                    ? 'sem leitura'
                    : `${formatarNumero(rpa.chuva_24h_mm)} mm`}
                </TableCell>
                <TableCell>
                  <Marcador cor={corDoAlerta(rpa.alerta_nivel)} />
                  {rpa.alerta_nivel ?? 'Nenhum'}
                </TableCell>
                <TableCell>{rotuloDaPrioridade(rpa.prioridade)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell>Recife</TableCell>
              <TableCell className="text-right tabular-nums">
                {total === null ? '—' : formatarNumero(total)}
              </TableCell>
              <TableCell colSpan={3} />
            </TableRow>
          </TableFooter>
        </Table>
      </div>

      {/* RN-007: nunca a hora atual quando a data da fonte é desconhecida. */}
      <ul className="grid gap-1 text-sm text-muted-foreground" aria-label="Fontes do mapa">
        {FONTES.map(({ fonte, rotulo }) => {
          const atualizadaEm = atualizacaoDaFonte(mapa.fontes, fonte)
          return (
            <li key={fonte}>
              {rotulo} ·{' '}
              {atualizadaEm
                ? `atualizada em ${formatarDataHora(atualizadaEm)}`
                : 'sem informação de atualização'}
            </li>
          )
        })}
        {/* DEC-036: a chuva do mapa é do Cemaden */}
        <li>{ATRIBUICAO_CEMADEN}</li>
      </ul>
    </>
  )
}

function Marcador({ cor }: { cor: string }) {
  return (
    <span
      aria-hidden
      className="mr-2 inline-block size-2.5 rounded-full align-middle"
      style={{ backgroundColor: cor }}
    />
  )
}

function Legenda({ titulo, itens }: { titulo: string; itens: ItemLegenda[] }) {
  return (
    <div className="rounded-xl border p-4">
      <h3 className="mb-2 text-sm font-medium">{titulo}</h3>
      <ul className="grid gap-1.5 text-sm" aria-label={titulo}>
        {itens.map((item) => (
          <li key={item.rotulo} className="flex items-center">
            <Marcador cor={item.cor} />
            {item.rotulo}
          </li>
        ))}
      </ul>
    </div>
  )
}
