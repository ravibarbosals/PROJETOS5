// Valores que o job compara com os parâmetros (RN-012): a chuva é somada na
// janela do parâmetro; as outras variáveis usam a própria leitura.

const HORA_MS = 60 * 60 * 1000;

export const VARIAVEIS_ACUMULADAS: readonly string[] = ['precipitacao_mm'];

export interface LeituraDoGold {
  fonte: string;
  estacao: string;
  lidaEm: Date;
  valor: number;
}

// Um ponto por hora de leitura, com a fonte e a estação que deram o valor.
export type PontoAvaliado = LeituraDoGold;

// decimal(12,3) no banco: arredonda para não acumular erro de ponto flutuante.
const arredondar = (valor: number) => Math.round(valor * 1000) / 1000;

function serieDaEstacao(
  leituras: LeituraDoGold[],
  janelaHoras: number,
  acumulada: boolean,
): PontoAvaliado[] {
  const ordenadas = [...leituras].sort(
    (a, b) => a.lidaEm.getTime() - b.lidaEm.getTime(),
  );
  if (!acumulada) return ordenadas;
  return ordenadas.map((leitura) => {
    const inicio = leitura.lidaEm.getTime() - janelaHoras * HORA_MS;
    const soma = ordenadas
      .filter(
        (l) =>
          l.lidaEm.getTime() > inicio &&
          l.lidaEm.getTime() <= leitura.lidaEm.getTime(),
      )
      .reduce((total, l) => total + l.valor, 0);
    return { ...leitura, valor: arredondar(soma) };
  });
}

// Série de uma variável + território em ordem de lidaEm. Com mais de uma
// estação no território, vale a de maior valor em cada hora.
export function serieDoParametro(
  leituras: LeituraDoGold[],
  janelaHoras: number,
  acumulada: boolean,
): PontoAvaliado[] {
  const porEstacao = new Map<string, LeituraDoGold[]>();
  for (const leitura of leituras) {
    const chave = `${leitura.fonte}|${leitura.estacao}`;
    porEstacao.set(chave, [...(porEstacao.get(chave) ?? []), leitura]);
  }

  const porHora = new Map<number, PontoAvaliado>();
  for (const daEstacao of porEstacao.values()) {
    for (const ponto of serieDaEstacao(daEstacao, janelaHoras, acumulada)) {
      const hora = ponto.lidaEm.getTime();
      const atual = porHora.get(hora);
      if (!atual || ponto.valor > atual.valor) porHora.set(hora, ponto);
    }
  }
  return [...porHora.values()].sort(
    (a, b) => a.lidaEm.getTime() - b.lidaEm.getTime(),
  );
}
