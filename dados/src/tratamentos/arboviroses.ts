import type { Agravo } from '../coletores/arboviroses.js';

export interface Indicador {
  fonte: string;
  territorio: string;
  bairro: string;
  indicador: Agravo;
  // Semana epidemiológica: 2025-SE01 (não é a semana ISO)
  periodo: string;
  valor: number;
}

const AGRAVOS: readonly string[] = ['dengue', 'chikungunya', 'zika'];

function isObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

// Soma as contagens de várias coletas (a última de cada recurso). Somar é
// preciso porque o arquivo de um ano traz algumas notificações com semana do
// ano seguinte, e as duas parcelas caem na mesma linha do gold.
export function montarIndicadores(payloads: unknown[]): Indicador[] {
  const porChave = new Map<string, Indicador>();

  for (const payload of payloads) {
    if (
      !isObjeto(payload) ||
      !AGRAVOS.includes(String(payload.agravo)) ||
      !Array.isArray(payload.contagens)
    ) {
      throw new Error('payload de arboviroses sem agravo ou contagens');
    }
    const indicador = payload.agravo as Agravo;

    for (const c of payload.contagens) {
      if (
        !isObjeto(c) ||
        typeof c.bairro !== 'string' ||
        typeof c.semana !== 'string' ||
        !/^\d{6}$/.test(c.semana) ||
        typeof c.casos !== 'number'
      ) {
        throw new Error('contagem de arboviroses inválida');
      }
      const periodo = `${c.semana.slice(0, 4)}-SE${c.semana.slice(4)}`;
      const chave = `${indicador}|${c.bairro}|${periodo}`;
      const atual = porChave.get(chave);
      if (atual) {
        atual.valor += c.casos;
      } else {
        porChave.set(chave, {
          fonte: 'recife_arboviroses',
          territorio: 'Recife',
          bairro: c.bairro,
          indicador,
          periodo,
          valor: c.casos,
        });
      }
    }
  }
  return [...porChave.values()];
}