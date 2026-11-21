import { PONTOS, type PontoOpenMeteo } from '../coletores/openmeteo.js';

export type Variavel =
  'precipitacao_mm' | 'temperatura_c' | 'umidade_pct' | 'pressao_hpa';

export interface Leitura {
  fonte: string;
  estacao: string;
  territorio: string;
  variavel: Variavel;
  valor: number;
  lidaEm: Date;
}

// Campo do Open-Meteo -> nome da variável usado no gold
const VARIAVEIS: Record<string, Variavel> = {
  precipitation: 'precipitacao_mm',
  temperature_2m: 'temperatura_c',
  relative_humidity_2m: 'umidade_pct',
  surface_pressure: 'pressao_hpa',
};

// Coletas de antes das RPAs (DEC-035): um objeto só, do Recife inteiro.
const PONTO_RECIFE: PontoOpenMeteo = {
  estacao: 'recife',
  territorio: 'Recife',
  latitude: '-8.05',
  longitude: '-34.9',
};

function isObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function extrairDoPonto(
  payload: unknown,
  ponto: PontoOpenMeteo,
  coletadoEm: Date,
): Leitura[] {
  if (!isObjeto(payload) || !isObjeto(payload.hourly)) {
    throw new Error('payload do Open-Meteo sem hourly');
  }
  const hourly = payload.hourly;
  if (!Array.isArray(hourly.time)) {
    throw new Error('payload do Open-Meteo sem hourly.time');
  }
  const horas: unknown[] = hourly.time;

  const leituras: Leitura[] = [];
  for (const [campo, variavel] of Object.entries(VARIAVEIS)) {
    const valores = hourly[campo];
    if (!Array.isArray(valores)) {
      throw new Error(`payload do Open-Meteo sem hourly.${campo}`);
    }
    horas.forEach((hora, i) => {
      const valor: unknown = valores[i];
      // A API devolve horários em UTC sem o sufixo de fuso
      const lidaEm = new Date(`${String(hora)}Z`);
      if (typeof valor !== 'number' || Number.isNaN(lidaEm.getTime())) {
        return;
      }
      // Horas depois da coleta são previsão, não leitura
      if (lidaEm > coletadoEm) {
        return;
      }
      leituras.push({
        fonte: 'openmeteo',
        estacao: ponto.estacao,
        territorio: ponto.territorio,
        variavel,
        valor,
        lidaEm,
      });
    });
  }
  return leituras;
}

// Com vários pontos a API devolve uma lista, na ordem de PONTOS; a coleta
// antiga, de um ponto só, é um objeto.
export function extrairLeituras(payload: unknown, coletadoEm: Date): Leitura[] {
  if (!Array.isArray(payload)) {
    return extrairDoPonto(payload, PONTO_RECIFE, coletadoEm);
  }
  if (payload.length !== PONTOS.length) {
    throw new Error(
      `payload do Open-Meteo com ${payload.length} pontos, esperados ${PONTOS.length}`,
    );
  }
  return payload.flatMap((doPonto, i) =>
    extrairDoPonto(doPonto, PONTOS[i], coletadoEm),
  );
}
