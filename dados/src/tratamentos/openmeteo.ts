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

// Open-Meteo field -> variable name used in gold
const VARIAVEIS: Record<string, Variavel> = {
  precipitation: 'precipitacao_mm',
  temperature_2m: 'temperatura_c',
  relative_humidity_2m: 'umidade_pct',
  surface_pressure: 'pressao_hpa',
};

function isObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

export function extrairLeituras(payload: unknown, coletadoEm: Date): Leitura[] {
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
      // The API returns UTC times without the zone suffix
      const lidaEm = new Date(`${String(hora)}Z`);
      if (typeof valor !== 'number' || Number.isNaN(lidaEm.getTime())) {
        return;
      }
      // Hours after the collection are forecast, not readings
      if (lidaEm > coletadoEm) {
        return;
      }
      leituras.push({
        fonte: 'openmeteo',
        estacao: 'recife',
        territorio: 'Recife',
        variavel,
        valor,
        lidaEm,
      });
    });
  }
  return leituras;
}