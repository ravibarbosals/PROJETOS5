import { FONTE_CEMADEN, SENSOR_PLUVIOMETRO } from '../coletores/cemaden.js';
import { dentroDoMultiPoligono, type Ponto } from './geo.js';
import type { Leitura } from './openmeteo.js';

// Limite de uma RPA como o gold.territorio guarda (MultiPolygon, DEC-038)
export interface LimiteDaRpa {
  territorio: string;
  coordenadas: Ponto[][][];
}

function isObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

// Cada estação vai para a RPA cujo limite contém o ponto; fora de todas,
// fica no Recife (DEC-035).
function territorioDoPonto(ponto: Ponto, limites: LimiteDaRpa[]): string {
  return (
    limites.find((l) => dentroDoMultiPoligono(ponto, l.coordenadas))?.territorio ??
    'Recife'
  );
}

// Uma leitura por pluviômetro e horário (DEC-045). O valor é a chuva do
// intervalo desde a leitura anterior; o job soma na janela (RN-012).
export function extrairLeiturasCemaden(
  payload: unknown,
  limites: LimiteDaRpa[],
): Leitura[] {
  if (!Array.isArray(payload)) {
    throw new Error('payload do Cemaden não é uma lista');
  }
  // Sem limites, toda estação cairia no Recife: espera o próximo ciclo
  if (limites.length === 0) {
    throw new Error('limites das RPAs ainda não carregados no gold');
  }

  const territorios = new Map<string, string>();
  const leituras: Leitura[] = [];
  for (const linha of payload) {
    if (!isObjeto(linha) || linha.id_sensor !== SENSOR_PLUVIOMETRO) continue;
    const { codestacao, datahora, valor, latitude, longitude } = linha;
    if (
      typeof codestacao !== 'string' ||
      typeof datahora !== 'string' ||
      typeof valor !== 'number' ||
      typeof latitude !== 'number' ||
      typeof longitude !== 'number'
    ) {
      continue;
    }
    // "2026-11-24 15:40:00", em UTC
    const lidaEm = new Date(`${datahora.replace(' ', 'T')}Z`);
    if (Number.isNaN(lidaEm.getTime())) continue;

    let territorio = territorios.get(codestacao);
    if (!territorio) {
      territorio = territorioDoPonto([longitude, latitude], limites);
      territorios.set(codestacao, territorio);
    }
    leituras.push({
      fonte: FONTE_CEMADEN,
      estacao: codestacao,
      territorio,
      variavel: 'precipitacao_mm',
      valor,
      lidaEm,
    });
  }
  return leituras;
}
