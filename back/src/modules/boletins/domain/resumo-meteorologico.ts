import type { LeituraResponseDto } from '@/modules/paineis/leitura/dto/leitura-response.dto';
import { VariavelClimatica } from '@/modules/paineis/leitura/enums/variavel-climatica.enum';

// TASK-032: a seção "Situação meteorológica" do boletim (RN-009) com os mesmos
// números dos cartões da EST-01 (PR-013), sobre as leituras das últimas 24 h.
// Com várias estações (as RPAs, DEC-035), vale a de maior valor (DEC-034).

export interface LeituraPontual {
  valor: number;
  lidaEm: Date;
}

export interface ResumoMeteorologico {
  chuvaAcumulada: number | null;
  chuvaUltimaHora: LeituraPontual | null;
  temperaturaMaxima: LeituraPontual | null;
  umidadeAtual: LeituraPontual | null;
  fontes: string[];
  /** Atualização mais recente entre as fontes (REQ-019); nula sem registro */
  atualizadaEm: Date | null;
}

const daVariavel = (
  leituras: LeituraResponseDto[],
  variavel: VariavelClimatica,
) => leituras.filter((l) => l.variavel === variavel);

function escolher(
  leituras: LeituraResponseDto[],
  melhor: (a: LeituraResponseDto, b: LeituraResponseDto) => boolean,
): LeituraPontual | null {
  const escolhida = leituras.reduce<LeituraResponseDto | null>(
    (atual, l) => (!atual || melhor(l, atual) ? l : atual),
    null,
  );
  return escolhida && { valor: escolhida.valor, lidaEm: escolhida.lida_em };
}

// A hora mais recente; na mesma hora, a estação de maior valor.
const maisRecente = (a: LeituraResponseDto, b: LeituraResponseDto) =>
  a.lida_em > b.lida_em ||
  (a.lida_em.getTime() === b.lida_em.getTime() && a.valor > b.valor);
const maiorValor = (a: LeituraResponseDto, b: LeituraResponseDto) =>
  a.valor > b.valor;

// Soma em centésimos de mm para não acumular erro de ponto flutuante.
const somar = (valores: number[]) =>
  valores.reduce((total, v) => total + Math.round(v * 100), 0) / 100;

// DEC-034: soma a chuva de cada estação e fica com o maior acumulado; somar
// as estações juntas multiplicaria a chuva pelo número de pontos.
function maiorAcumulado(chuva: LeituraResponseDto[]): number | null {
  if (chuva.length === 0) return null;
  const porEstacao = new Map<string, number[]>();
  for (const l of chuva) {
    const chave = `${l.fonte}|${l.estacao}`;
    porEstacao.set(chave, [...(porEstacao.get(chave) ?? []), l.valor]);
  }
  return Math.max(...[...porEstacao.values()].map(somar));
}

// Nulo quando não há nenhuma leitura no período: a seção diz isso.
export function resumirMeteorologia(
  leituras: LeituraResponseDto[],
): ResumoMeteorologico | null {
  if (leituras.length === 0) return null;
  const chuva = daVariavel(leituras, VariavelClimatica.Precipitacao);
  const atualizacoes = leituras
    .map((l) => l.fonte_atualizada_em)
    .filter((d): d is Date => d !== null);
  return {
    chuvaAcumulada: maiorAcumulado(chuva),
    chuvaUltimaHora: escolher(chuva, maisRecente),
    temperaturaMaxima: escolher(
      daVariavel(leituras, VariavelClimatica.Temperatura),
      maiorValor,
    ),
    umidadeAtual: escolher(
      daVariavel(leituras, VariavelClimatica.Umidade),
      maisRecente,
    ),
    fontes: [...new Set(leituras.map((l) => l.fonte))].sort(),
    atualizadaEm: atualizacoes.reduce<Date | null>(
      (maior, d) => (!maior || d > maior ? d : maior),
      null,
    ),
  };
}
