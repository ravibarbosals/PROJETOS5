import { PONTOS, type Coleta } from './openmeteo.js';

export const FONTE_CLIMA_HISTORICO = 'openmeteo_historico';

export interface Janela {
  inicio: string;
  fim: string;
}

// Datas no formato AAAA-MM-DD, contadas em UTC para não sofrer com fuso.
export function somarDias(dia: string, dias: number): string {
  const data = new Date(`${dia}T00:00:00Z`);
  data.setUTCDate(data.getUTCDate() + dias);
  return data.toISOString().slice(0, 10);
}

// Hoje no Recife (a API agrega os dias no fuso local).
export function hojeNoRecife(agora = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Recife',
  }).format(agora);
}

// Os dias recentes vêm do modelo de previsão e são trocados pela reanálise
// (ERA5) alguns dias depois: a carga diária refaz este trecho.
const DIAS_REVISADOS = 30;
const HORAS_ENTRE_COLETAS = 20;

interface EstadoHistorico {
  // Primeiro ano de arboviroses no gold (DEC-031); nulo sem dado nenhum
  primeiroAno: number | null;
  // Menor início entre as coletas bem-sucedidas; nulo se nunca coletou
  carregadoDesde: string | null;
  ultimaColetaEm: Date | null;
  agora: Date;
}

// DEC-042: o clima acompanha os anos de arboviroses, a partir de 1º de
// novembro do ano anterior (as defasagens de chuva e temperatura do modelo
// chegam a 4 semanas, e a SE01 pode começar no fim de dezembro). A primeira
// carga traz tudo até ontem; depois, uma vez por dia, só os últimos 30 dias.
// Se o primeiro ano recuar (TASK-074), a carga completa roda de novo.
export function janelaDoHistorico(estado: EstadoHistorico): Janela | null {
  if (estado.primeiroAno === null) return null;
  const hoje = hojeNoRecife(estado.agora);
  const inicio = `${estado.primeiroAno - 1}-11-01`;
  const fim = somarDias(hoje, -1);

  if (estado.carregadoDesde === null || estado.carregadoDesde > inicio) {
    return { inicio, fim };
  }
  const horasDesde =
    estado.ultimaColetaEm &&
    (estado.agora.getTime() - estado.ultimaColetaEm.getTime()) / 3_600_000;
  if (horasDesde !== null && horasDesde < HORAS_ENTRE_COLETAS) return null;

  const recente = somarDias(hoje, -DIAS_REVISADOS);
  return { inicio: recente > inicio ? recente : inicio, fim };
}

export function urlDoHistorico({ inicio, fim }: Janela): string {
  return (
    'https://archive-api.open-meteo.com/v1/archive?' +
    new URLSearchParams({
      latitude: PONTOS.map((p) => p.latitude).join(','),
      longitude: PONTOS.map((p) => p.longitude).join(','),
      start_date: inicio,
      end_date: fim,
      daily:
        'precipitation_sum,temperature_2m_mean,temperature_2m_min,' +
        'temperature_2m_max,relative_humidity_2m_mean',
      timezone: 'America/Recife',
    }).toString()
  );
}

// O payload guarda a janela pedida junto com a resposta, para a próxima
// coleta saber até onde o histórico já foi.
export async function coletarClimaHistorico(janela: Janela): Promise<Coleta> {
  const url = urlDoHistorico(janela);
  try {
    const resposta = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    const corpo: unknown = resposta.ok
      ? await resposta.json()
      : { erro: await resposta.text() };
    return {
      fonte: FONTE_CLIMA_HISTORICO,
      url,
      statusHttp: resposta.status,
      payload: { ...janela, resposta: corpo },
    };
  } catch (erro) {
    return {
      fonte: FONTE_CLIMA_HISTORICO,
      url,
      statusHttp: 0,
      payload: { ...janela, erro: String(erro) },
    };
  }
}
