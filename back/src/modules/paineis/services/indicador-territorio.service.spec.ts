import type { DataSource } from 'typeorm';
import { IndicadorEpidemiologico } from '@/modules/paineis/enums/indicador-epidemiologico.enum';
import { IndicadorTerritorioService } from '@/modules/paineis/services/indicador-territorio.service';

function setup(ultimoAno: number | null, linhas: unknown[] = []) {
  const query = jest
    .fn()
    .mockImplementation((sql: string) =>
      Promise.resolve(sql.includes('max(') ? [{ ano: ultimoAno }] : linhas),
    );
  const service = new IndicadorTerritorioService({
    query,
  } as unknown as DataSource);
  return { service, query };
}

describe('IndicadorTerritorioService', () => {
  it('uses the last year with data when none is given (DEC-031)', async () => {
    const { service, query } = setup(2025);

    await service.listar({ indicador: IndicadorEpidemiologico.Zika });

    expect(query).toHaveBeenNthCalledWith(1, expect.any(String), ['zika']);
    expect(query).toHaveBeenLastCalledWith(expect.any(String), [
      '2025-SE%',
      'zika',
      null,
    ]);
  });

  it('answers an empty list when the gold has no data', async () => {
    const { service, query } = setup(null);

    expect(await service.listar({})).toEqual([]);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('passes year and neighborhood as parameters, never in the SQL text', async () => {
    const { service, query } = setup(2025);

    await service.listar({ ano: 2024, bairro: "IBURA'; DROP TABLE x; --" });

    expect(query).toHaveBeenCalledTimes(1);
    const [sql, parametros] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).not.toContain('IBURA');
    expect(parametros).toEqual(['2024-SE%', null, "IBURA'; DROP TABLE x; --"]);
  });
});
