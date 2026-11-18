export interface Coleta {
  fonte: string;
  url: string;
  statusHttp: number;
  payload: unknown;
}

const FONTE = 'openmeteo';

// Recife, hourly data for the last 7 days and today, timestamps in UTC.
// 7 past days fill the gaps while the system was off (the upsert does not duplicate)
const URL_OPENMETEO =
  'https://api.open-meteo.com/v1/forecast?' +
  new URLSearchParams({
    latitude: '-8.05',
    longitude: '-34.9',
    hourly:
      'temperature_2m,relative_humidity_2m,precipitation,surface_pressure',
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
    // Network failure or timeout: no HTTP status, recorded as 0
    return {
      fonte: FONTE,
      url: URL_OPENMETEO,
      statusHttp: 0,
      payload: { erro: String(erro) },
    };
  }
}