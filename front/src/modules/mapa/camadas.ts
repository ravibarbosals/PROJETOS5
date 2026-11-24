import type { NivelAlerta } from '@/modules/alertas/types'
import type { FonteDoMapa, RpaMapa } from '@/modules/mapa/types'

// Cores e faixas do mapa da EST-01 (DEC-038). O Leaflet desenha fora do CSS do
// tema, então as cores são valores fixos.

export interface ItemLegenda {
  rotulo: string
  cor: string
}

const SEM_DADO = '#94a3b8'

export const LEGENDA_ALERTA: ItemLegenda[] = [
  { rotulo: 'Alerta alto', cor: '#dc2626' },
  { rotulo: 'Alerta moderado', cor: '#f59e0b' },
  { rotulo: 'Sem alerta ativo', cor: SEM_DADO },
]

export function corDoAlerta(nivel: NivelAlerta | null): string {
  if (nivel === 'ALTO') return LEGENDA_ALERTA[0].cor
  if (nivel === 'MODERADO') return LEGENDA_ALERTA[1].cor
  return SEM_DADO
}

// PR-031: faixas só de leitura do mapa, sem significado de risco; o risco
// vem dos parâmetros de alerta (PR-008).
const FAIXAS_CHUVA: { abaixoDe: number; rotulo: string; cor: string }[] = [
  { abaixoDe: 0.1, rotulo: 'Sem chuva', cor: '#e0f2fe' },
  { abaixoDe: 5, rotulo: 'Até 5 mm', cor: '#7dd3fc' },
  { abaixoDe: 25, rotulo: '5 a 25 mm', cor: '#38bdf8' },
  { abaixoDe: 50, rotulo: '25 a 50 mm', cor: '#0284c7' },
  { abaixoDe: Infinity, rotulo: '50 mm ou mais', cor: '#1e3a8a' },
]

export const LEGENDA_CHUVA: ItemLegenda[] = [
  ...FAIXAS_CHUVA.map(({ rotulo, cor }) => ({ rotulo, cor })),
  { rotulo: 'Sem leitura', cor: SEM_DADO },
]

export function corDaChuva(mm: number | null): string {
  if (mm === null) return SEM_DADO
  return FAIXAS_CHUVA.find((f) => mm < f.abaixoDe)!.cor
}

// Níveis da Defesa Civil: 4 é o mais grave
const COR_DO_RISCO: Record<number, string> = {
  4: '#7f1d1d',
  3: '#dc2626',
  2: '#f97316',
  1: '#facc15',
}

export const LEGENDA_RISCO: ItemLegenda[] = [
  ...[4, 3, 2, 1].map((nivel) => ({ rotulo: `Nível ${nivel}`, cor: COR_DO_RISCO[nivel] })),
  { rotulo: 'Sem nível (lona, deslizamento, não informado)', cor: '#475569' },
]

export function corDoRisco(nivel: number | null): string {
  return (nivel !== null && COR_DO_RISCO[nivel]) || LEGENDA_RISCO[4].cor
}

export function rotuloDoRisco(nivel: number | null): string {
  return nivel === null ? 'Sem nível' : `Nível ${nivel}`
}

// Total do Recife: só quando todas as RPAs têm população
export function populacaoTotal(rpas: RpaMapa[]): number | null {
  if (rpas.length === 0 || rpas.some((r) => r.populacao === null)) return null
  return rpas.reduce((soma, r) => soma + (r.populacao ?? 0), 0)
}

// RN-016: as RPAs prioritárias (com alerta ativo nelas), na ordem da API
export function areasPrioritarias(rpas: RpaMapa[]): RpaMapa[] {
  return rpas
    .filter((r) => r.prioridade !== null)
    .sort((a, b) => (a.prioridade ?? 0) - (b.prioridade ?? 0))
}

// RN-016 #4 (EST-03): pessoas em risco = população residente das prioritárias
// (PR-030); RPA sem população não soma
export function pessoasEmRisco(rpas: RpaMapa[]): number {
  return areasPrioritarias(rpas).reduce((soma, r) => soma + (r.populacao ?? 0), 0)
}

export function rotuloDaPrioridade(prioridade: number | null): string {
  return prioridade === null ? '—' : `${prioridade}ª`
}

// RN-007: null quando a fonte não tem coleta; nunca a hora atual
export function atualizacaoDaFonte(fontes: FonteDoMapa[], fonte: string): string | null {
  return fontes.find((f) => f.fonte === fonte)?.ultima_atualizacao ?? null
}

// Retângulo [sul-oeste, nordeste] em latitude/longitude que contém os limites
// das RPAs, para o mapa abrir enquadrado; null sem nenhum limite gravado
export function enquadramento(
  rpas: RpaMapa[],
): [[number, number], [number, number]] | null {
  const pontos = rpas.flatMap((r) => r.limite?.coordinates.flat(2) ?? [])
  if (pontos.length === 0) return null
  const lats = pontos.map(([, lat]) => lat)
  const lons = pontos.map(([lon]) => lon)
  return [
    [Math.min(...lats), Math.min(...lons)],
    [Math.max(...lats), Math.max(...lons)],
  ]
}
