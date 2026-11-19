export interface Coleta {
  fonte: string;
  url: string;
  statusHttp: number;
  payload: unknown;
}

const FONTE = 'openmeteo';

// Recife, dados por hora dos últimos 7 dias e de hoje, horários em UTC. Os 7
// dias passados preenchem as lacunas de quando o sistema ficou desligado (o
// upsert não duplica)
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
    // Falha de rede ou timeout: sem status HTTP, registrado como 0
    return {
      fonte: FONTE,
      url: URL_OPENMETEO,
      statusHttp: 0,
      payload: { erro: String(erro) },
    };
  }
}