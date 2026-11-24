import { NivelAlerta } from '@/modules/alertas/enums/nivel-alerta.enum';
import {
  areasPrioritarias,
  type RpaComAlerta,
} from '@/modules/paineis/mapa/domain/area-prioritaria';

const rpa = (
  numero: number,
  populacao: number | null,
  alerta_nivel: NivelAlerta | null = NivelAlerta.Moderado,
): RpaComAlerta => ({ rpa: numero, populacao, alerta_nivel });

// RN-016.
describe('areasPrioritarias', () => {
  it('only RPAs with an active alert are priority (RN-016 #1)', () => {
    const prioridades = areasPrioritarias([
      rpa(1, 80_000, null),
      rpa(2, 50_000),
      rpa(3, 90_000, null),
    ]);

    expect([...prioridades]).toEqual([[2, 1]]);
  });

  it('orders by resident population, largest first, whatever the level (RN-016 #3)', () => {
    const prioridades = areasPrioritarias([
      rpa(1, 80_000, NivelAlerta.Alto),
      rpa(4, 280_000, NivelAlerta.Moderado),
      rpa(6, 372_982, NivelAlerta.Moderado),
    ]);

    expect([...prioridades]).toEqual([
      [6, 1],
      [4, 2],
      [1, 3],
    ]);
  });

  it('puts an RPA without population last and breaks ties by RPA number', () => {
    const prioridades = areasPrioritarias([
      rpa(5, null),
      rpa(3, 100_000),
      rpa(2, 100_000),
    ]);

    expect([...prioridades]).toEqual([
      [2, 1],
      [3, 2],
      [5, 3],
    ]);
  });

  it('is empty without any active alert', () => {
    expect(areasPrioritarias([rpa(1, 80_000, null)]).size).toBe(0);
  });
});
