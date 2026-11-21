import type { Periodo } from '@/lib/periodo'
import type { Leitura, Variavel } from '@/modules/leituras/types'

export interface LeituraPontual {
  valor: number
  lida_em: string
}

// Cartões da PR-013, calculados sobre as leituras do período.
export interface ResumoClimatico {
  chuvaUltimaHora: LeituraPontual | null
  chuvaAcumulada: number | null
  temperaturaMaxima: LeituraPontual | null
  umidadeAtual: LeituraPontual | null
}

const daVariavel = (leituras: Leitura[], variavel: Variavel) =>
  leituras.filter((l) => l.variavel === variavel)

// Com várias estações (as RPAs, DEC-035) vale a de maior valor (DEC-034): na
// hora mais recente, a maior leitura dessa hora.
function maisRecente(leituras: Leitura[]): LeituraPontual | null {
  let escolhida: Leitura | null = null
  for (const l of leituras) {
    if (
      !escolhida ||
      l.lida_em > escolhida.lida_em ||
      (l.lida_em === escolhida.lida_em && l.valor > escolhida.valor)
    ) {
      escolhida = l
    }
  }
  return escolhida && { valor: escolhida.valor, lida_em: escolhida.lida_em }
}

function maiorValor(leituras: Leitura[]): LeituraPontual | null {
  let escolhida: Leitura | null = null
  for (const l of leituras) if (!escolhida || l.valor > escolhida.valor) escolhida = l
  return escolhida && { valor: escolhida.valor, lida_em: escolhida.lida_em }
}

// Soma em centésimos de mm para não acumular erro de ponto flutuante.
const somar = (valores: number[]) =>
  valores.reduce((total, v) => total + Math.round(v * 100), 0) / 100

const estacaoDe = (l: Leitura) => `${l.fonte}|${l.estacao}`

// DEC-034: soma a chuva de cada estação e fica com o maior acumulado. Somar as
// estações juntas multiplicaria a chuva pelo número de pontos.
function maiorAcumulado(chuva: Leitura[]): number | null {
  if (chuva.length === 0) return null
  const porEstacao = new Map<string, number[]>()
  for (const l of chuva) {
    porEstacao.set(estacaoDe(l), [...(porEstacao.get(estacaoDe(l)) ?? []), l.valor])
  }
  return Math.max(...[...porEstacao.values()].map(somar))
}

export function resumirLeituras(leituras: Leitura[]): ResumoClimatico {
  const chuva = daVariavel(leituras, 'precipitacao_mm')
  return {
    chuvaUltimaHora: maisRecente(chuva),
    chuvaAcumulada: maiorAcumulado(chuva),
    temperaturaMaxima: maiorValor(daVariavel(leituras, 'temperatura_c')),
    umidadeAtual: maisRecente(daVariavel(leituras, 'umidade_pct')),
  }
}

// RN-007: a atualização mais recente entre as fontes das leituras; null se não houver.
export function ultimaAtualizacao(leituras: Leitura[]): string | null {
  let maior: string | null = null
  for (const { fonte_atualizada_em: em } of leituras) if (em && (!maior || em > maior)) maior = em
  return maior
}

export interface PontoDoGrafico {
  chave: string
  rotulo: string
  chuva: number | null
  temperatura: number | null
}

const formatoHora = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Recife',
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
})

const formatoDia = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Recife',
  day: '2-digit',
  month: '2-digit',
})

// "dd/mm" do dia no Recife, também usado como chave do agrupamento.
const diaNoRecife = (iso: string) => formatoDia.format(new Date(iso))

// 30 dias por hora são 720 barras: acima de 7 dias o gráfico agrupa por dia
// (DEC-028), com a chuva somada e a temperatura máxima do dia (PR-013). Com
// várias estações, cada barra mostra a de mais chuva (DEC-034).
export function serieDoGrafico(leituras: Leitura[], periodo: Periodo): PontoDoGrafico[] {
  const porDia = periodo === '30d'
  const pontos = new Map<string, PontoDoGrafico>()
  // Chuva de cada estação em cada barra, para ficar com a maior.
  const chuvaPorEstacao = new Map<string, Map<string, number>>()

  const ordenadas = [...leituras].sort((a, b) => a.lida_em.localeCompare(b.lida_em))
  for (const l of ordenadas) {
    if (l.variavel !== 'precipitacao_mm' && l.variavel !== 'temperatura_c') continue
    const chave = porDia ? diaNoRecife(l.lida_em) : l.lida_em
    let ponto = pontos.get(chave)
    if (!ponto) {
      const rotulo = porDia
        ? chave
        : `${formatoHora.format(new Date(l.lida_em)).replace(', ', ' ')}h`
      ponto = { chave, rotulo, chuva: null, temperatura: null }
      pontos.set(chave, ponto)
    }
    if (l.variavel === 'precipitacao_mm') {
      const estacoes = chuvaPorEstacao.get(chave) ?? new Map<string, number>()
      const soma = somar([estacoes.get(estacaoDe(l)) ?? 0, l.valor])
      estacoes.set(estacaoDe(l), soma)
      chuvaPorEstacao.set(chave, estacoes)
      ponto.chuva = Math.max(ponto.chuva ?? 0, soma)
    } else {
      ponto.temperatura = Math.max(ponto.temperatura ?? -Infinity, l.valor)
    }
  }
  return [...pontos.values()]
}
