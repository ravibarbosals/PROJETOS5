import type { DataSource } from 'typeorm';
import { PeriodoPainel } from '@/modules/paineis/enums/periodo-painel.enum';
import { VariavelClimatica } from '@/modules/paineis/enums/variavel-climatica.enum';
import { LeituraService } from '@/modules/paineis/services/leitura.service';

const AGORA = new Date('2026-11-18T12:00:00.000Z');

function setup(linhas: unknown[] = []) {
  const query = jest.fn().mockResolvedValue(linhas);
  const service = new LeituraService({ query } as unknown as DataSource);
  return { service, query };
}

describe('LeituraService', () => {
  it('queries the window that ends now, with null for missing filters', async () => {
    const { service, query } = setup();

    await service.listar({ periodo: PeriodoPainel.Ultimas24Horas }, AGORA);

    expect(query).toHaveBeenCalledWith(expect.any(String), [
      new Date('2026-11-17T12:00:00.000Z'),
      AGORA,
      null,
      null,
    ]);
  });

  it('passes variable and territory as parameters, never in the SQL text', async () => {
    const { service, query } = setup();

    await service.listar(
      {
        periodo: PeriodoPainel.Ultimos7Dias,
        variavel: VariavelClimatica.Temperatura,
        territorio: "Recife'; DROP TABLE x; --",
      },
      AGORA,
    );

    const [sql, parametros] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).not.toContain('Recife');
    expect(parametros.slice(2)).toEqual([
      'temperatura_c',
      "Recife'; DROP TABLE x; --",
    ]);
  });

  it('turns numeric values into numbers and keeps a null source date (RN-007 #2)', async () => {
    const lidaEm = new Date('2026-11-18T10:00:00.000Z');
    const { service } = setup([
      {
        fonte: 'openmeteo',
        estacao: 'recife',
        territorio: 'Recife',
        variavel: 'precipitacao_mm',
        valor: '2.40',
        lida_em: lidaEm,
        fonte_atualizada_em: null,
      },
    ]);

    const resultado = await service.listar(
      { periodo: PeriodoPainel.Ultimas24Horas },
      AGORA,
    );

    expect(resultado).toEqual([
      {
        fonte: 'openmeteo',
        estacao: 'recife',
        territorio: 'Recife',
        variavel: 'precipitacao_mm',
        valor: 2.4,
        lida_em: lidaEm,
        fonte_atualizada_em: null,
      },
    ]);
  });
});
