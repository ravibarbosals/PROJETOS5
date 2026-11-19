import {
  LeituraDoGold,
  serieDoParametro,
} from '@/modules/alertas/domain/serie-de-valores';

const AGORA = new Date('2026-11-19T12:00:00Z');
const horasAtras = (horas: number) =>
  new Date(AGORA.getTime() - horas * 60 * 60 * 1000);

const leitura = (
  horas: number,
  valor: number,
  estacao = 'recife',
): LeituraDoGold => ({
  fonte: 'openmeteo',
  estacao,
  lidaEm: horasAtras(horas),
  valor,
});

describe('serieDoParametro (RN-012)', () => {
  it('sums the rain of the last N hours at each reading', () => {
    const serie = serieDoParametro(
      [leitura(0, 3), leitura(3, 10), leitura(1, 2), leitura(2, 5)],
      3,
      true,
    );

    expect(serie.map((p) => p.valor)).toEqual([10, 15, 17, 10]);
  });

  it('avoids floating point residue in the sum', () => {
    const serie = serieDoParametro([leitura(1, 0.1), leitura(0, 0.2)], 3, true);

    expect(serie.at(-1)?.valor).toBe(0.3);
  });

  it('keeps the reading itself for other variables', () => {
    const serie = serieDoParametro(
      [leitura(0, 29.5), leitura(1, 31)],
      3,
      false,
    );

    expect(serie.map((p) => p.valor)).toEqual([31, 29.5]);
  });

  it('takes the station with the highest value at each hour', () => {
    const serie = serieDoParametro(
      [leitura(0, 4, 'a'), leitura(0, 9, 'b'), leitura(1, 1, 'a')],
      1,
      true,
    );

    expect(serie).toEqual([leitura(1, 1, 'a'), { ...leitura(0, 9, 'b') }]);
  });
});
