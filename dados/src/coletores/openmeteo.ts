export interface Coleta {
  fonte: string;
  url: string;
  statusHttp: number;
  payload: unknown;
}

export interface PontoOpenMeteo {
  estacao: string;
  territorio: string;
  latitude: string;
  longitude: string;
}

const FONTE = 'openmeteo';

// Um ponto por RPA (DEC-035), no centróide do polígono oficial ("Limites por
// RPA - 2023", dados abertos da Prefeitura, convertido de EPSG:31985). O
// Open-Meteo é uma grade de ~8 km: as RPAs 1, 4 e 5 caem na mesma célula. A
// API devolve uma lista na mesma ordem dos pontos.
export const PONTOS: readonly PontoOpenMeteo[] = [
  { estacao: 'rpa1', territorio: 'RPA 1 - Centro', latitude: '-8.0600', longitude: '-34.8829' },
  { estacao: 'rpa2', territorio: 'RPA 2 - Norte', latitude: '-8.0166', longitude: '-34.8952' },
  { estacao: 'rpa3', territorio: 'RPA 3 - Noroeste', latitude: '-7.9802', longitude: '-34.9429' },
  { estacao: 'rpa4', territorio: 'RPA 4 - Oeste', latitude: '-8.0476', longitude: '-34.9554' },
  { estacao: 'rpa5', territorio: 'RPA 5 - Sudoeste', latitude: '-8.0816', longitude: '-34.9421' },
  { estacao: 'rpa6', territorio: 'RPA 6 - Sul', latitude: '-8.1141', longitude: '-34.9165' },
];

// Dados por hora dos últimos 7 dias e de hoje, horários em UTC. Os 7 dias
// passados preenchem as lacunas de quando o sistema ficou desligado (o upsert
// não duplica)
const URL_OPENMETEO =
  'https://api.open-meteo.com/v1/forecast?' +
  new URLSearchParams({
    latitude: PONTOS.map((p) => p.latitude).join(','),
    longitude: PONTOS.map((p) => p.longitude).join(','),
    // Sem precipitation: a chuva vem do Cemaden (DEC-045)
    hourly: 'temperature_2m,relative_humidity_2m,surface_pressure',
    past_days: '7',
    forecast_days: '1',
    timezone: 'GMT',
  }).toString();

export async function coletarOpenMeteo(): Promise<Coleta> {
  try {
    const resposta = await fetch(URL_OPENMETEO, {
      signal: AbortSignal.timeout(30_000),
    });
    const payload: unknown = resposta.ok
      ? await resposta.json()
      : { erro: await resposta.text() };
    return {
      fonte: FONTE,
      url: URL_OPENMETEO,
      statusHttp: resposta.status,
      payload,
    };
  } catch (erro) {
    // Falha de rede ou timeout: sem status HTTP, registrado como 0
    return {
      fonte: FONTE,
      url: URL_OPENMETEO,
      statusHttp: 0,
      payload: { erro: String(erro) },
    };
  }
}
