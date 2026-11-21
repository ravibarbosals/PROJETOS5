import { PONTOS } from '../coletores/openmeteo.js';
import { FONTE_CLIMA_HISTORICO } from '../coletores/openmeteo-historico.js';

export interface DiaClimatico {
  fonte: string;
  estacao: string;
  territorio: string;
  dia: string;
  chuvaMm: number | null;
  tempMediaC: number | null;
  tempMinC: number | null;
  tempMaxC: number | null;
  umidadeMediaPct: number | null;
}

type Campo = Exclude<
  keyof DiaClimatico,
  'fonte' | 'estacao' | 'territorio' | 'dia'
>;

// Campo diário do Open-Meteo -> coluna de gold.clima_diario
const CAMPOS: Record<string, Campo> = {
  precipitation_sum: 'chuvaMm',
  temperature_2m_mean: 'tempMediaC',
  temperature_2m_min: 'tempMinC',
  temperature_2m_max: 'tempMaxC',
  relative_humidity_2m_mean: 'umidadeMediaPct',
};

function isObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

// DEC-042: um registro por RPA e dia. A resposta é uma lista na ordem de
// PONTOS; dia sem nenhum valor fica de fora.
export function extrairDias(payload: unknown): DiaClimatico[] {
  if (!isObjeto(payload) || !Array.isArray(payload.resposta)) {
    throw new Error('payload do histórico sem resposta');
  }
  const resposta: unknown[] = payload.resposta;
  if (resposta.length !== PONTOS.length) {
    throw new Error(
      `histórico do Open-Meteo com ${resposta.length} pontos, esperados ${PONTOS.length}`,
    );
  }

  return resposta.flatMap((doPonto, i) => {
    const ponto = PONTOS[i];
    if (!isObjeto(doPonto) || !isObjeto(doPonto.daily)) {
      throw new Error(`histórico de ${ponto.estacao} sem daily`);
    }
    const daily = doPonto.daily;
    if (!Array.isArray(daily.time)) {
      throw new Error(`histórico de ${ponto.estacao} sem daily.time`);
    }
    const colunas = Object.entries(CAMPOS).map(([campo, coluna]) => {
      const valores = daily[campo];
      if (!Array.isArray(valores)) {
        throw new Error(`histórico de ${ponto.estacao} sem daily.${campo}`);
      }
      return { coluna, valores: valores as unknown[] };
    });

    return daily.time.flatMap((dia: unknown, j): DiaClimatico[] => {
      if (typeof dia !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dia)) {
        return [];
      }
      const registro: DiaClimatico = {
        fonte: FONTE_CLIMA_HISTORICO,
        estacao: ponto.estacao,
        territorio: ponto.territorio,
        dia,
        chuvaMm: null,
        tempMediaC: null,
        tempMinC: null,
        tempMaxC: null,
        umidadeMediaPct: null,
      };
      let algum = false;
      for (const { coluna, valores } of colunas) {
        const valor = valores[j];
        if (typeof valor === 'number' && Number.isFinite(valor)) {
          registro[coluna] = valor;
          algum = true;
        }
      }
      return algum ? [registro] : [];
    });
  });
}
