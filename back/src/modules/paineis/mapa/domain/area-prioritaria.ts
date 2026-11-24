import { NivelAlerta } from '@/modules/alertas/enums/nivel-alerta.enum';

export interface RpaComAlerta {
  rpa: number;
  populacao: number | null;
  /** Maior nível entre os alertas ativos da própria RPA; nulo sem alerta */
  alerta_nivel: NivelAlerta | null;
}

// RN-016 (PR-032): prioritária é a RPA com alerta ativo nela, sem critério de
// risco no MVP. Ordem: maior população residente primeiro (PR-030), sem
// população no fim, empate pelo número da RPA. Devolve a posição de cada
// prioritária (1 = primeira); as outras ficam fora do mapa.
export function areasPrioritarias(rpas: RpaComAlerta[]): Map<number, number> {
  const prioritarias = rpas
    .filter((r) => r.alerta_nivel !== null)
    .sort((a, b) => (b.populacao ?? -1) - (a.populacao ?? -1) || a.rpa - b.rpa);
  return new Map(prioritarias.map((r, i) => [r.rpa, i + 1]));
}
