import request from 'supertest';
import { Papel } from '@/modules/acesso/enums/papel.enum';
import { type AppE2e, criarAppE2e, limparBanco } from './helpers/e2e-app';
import {
  inserirLeitura,
  limparGold,
  registrarColeta,
} from './helpers/e2e-gold';
import { logado } from './helpers/e2e-usuarios';

const horasAtras = (horas: number) =>
  new Date(Date.now() - horas * 60 * 60 * 1000);

// MOD-005, RN-007, PER-010, DEC-035. O join com a view do gold só roda num banco de
// verdade.
describe('Leituras e status das fontes (e2e)', () => {
  let app: AppE2e;
  let token: string;

  beforeAll(async () => {
    app = await criarAppE2e();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await limparBanco(app);
    await limparGold(app);
    ({ token } = await logado(app, [Papel.Comunicacao]));
  });

  const get = (url: string) =>
    request(app.getHttpServer())
      .get(url)
      .set('Authorization', `Bearer ${token}`);

  it('lists the readings of the last 24h in order, with the source date (RN-007 #1)', async () => {
    const coletadoEm = horasAtras(0.5);
    const chuvaEm = horasAtras(2);
    await registrarColeta(app, 'openmeteo', coletadoEm);
    await inserirLeitura(app, {
      variavel: 'temperatura_c',
      valor: 29.1,
      lidaEm: horasAtras(1),
    });
    await inserirLeitura(app, {
      variavel: 'precipitacao_mm',
      valor: 2.4,
      lidaEm: chuvaEm,
    });
    await inserirLeitura(app, {
      variavel: 'precipitacao_mm',
      valor: 9,
      lidaEm: horasAtras(30),
    });

    const res = await get('/leituras').expect(200);

    expect(res.body).toEqual([
      {
        fonte: 'openmeteo',
        estacao: 'recife',
        territorio: 'Recife',
        variavel: 'precipitacao_mm',
        valor: 2.4,
        lida_em: chuvaEm.toISOString(),
        fonte_atualizada_em: coletadoEm.toISOString(),
      },
      expect.objectContaining({ variavel: 'temperatura_c', valor: 29.1 }),
    ]);
  });

  it('filters by period and variable', async () => {
    await inserirLeitura(app, {
      variavel: 'precipitacao_mm',
      valor: 9,
      lidaEm: horasAtras(30),
    });
    await inserirLeitura(app, {
      variavel: 'temperatura_c',
      valor: 28,
      lidaEm: horasAtras(30),
    });

    const res = await get(
      '/leituras?periodo=7d&variavel=precipitacao_mm',
    ).expect(200);

    expect(res.body).toEqual([
      expect.objectContaining({ variavel: 'precipitacao_mm', valor: 9 }),
    ]);
  });

  it('source without a successful collection: null, never the current time (RN-007 #2)', async () => {
    await inserirLeitura(app, {
      fonte: 'nasa_power',
      variavel: 'umidade_pct',
      valor: 80,
      lidaEm: horasAtras(1),
    });

    const res = await get('/leituras').expect(200);

    expect(res.body).toEqual([
      expect.objectContaining({
        fonte: 'nasa_power',
        fonte_atualizada_em: null,
      }),
    ]);
  });

  it('lists the last update of each source (REQ-019)', async () => {
    const ultimaOpenmeteo = horasAtras(1);
    const ultimaInmet = horasAtras(2);
    await registrarColeta(app, 'openmeteo', horasAtras(3));
    await registrarColeta(app, 'openmeteo', ultimaOpenmeteo);
    await registrarColeta(app, 'inmet', ultimaInmet);

    const res = await get('/fontes/status').expect(200);

    expect(res.body).toEqual([
      { fonte: 'inmet', ultima_atualizacao: ultimaInmet.toISOString() },
      { fonte: 'openmeteo', ultima_atualizacao: ultimaOpenmeteo.toISOString() },
    ]);
  });

  it('the Recife filter brings the RPAs; an RPA brings only itself (DEC-035)', async () => {
    const lidaEm = horasAtras(1);
    for (const [estacao, territorio, valor] of [
      ['recife', 'Recife', 1],
      ['rpa1', 'RPA 1 - Centro', 2],
      ['rpa6', 'RPA 6 - Sul', 3],
    ] as const) {
      await inserirLeitura(app, {
        estacao,
        territorio,
        variavel: 'precipitacao_mm',
        valor,
        lidaEm,
      });
    }
    const valores = async (territorio: string) =>
      (
        (
          await get(
            `/leituras?territorio=${encodeURIComponent(territorio)}`,
          ).expect(200)
        ).body as { valor: number }[]
      )
        .map((l) => l.valor)
        .sort();

    expect(await valores('Recife')).toEqual([1, 2, 3]);
    expect(await valores('RPA 6 - Sul')).toEqual([3]);
  });

  it('lists the territories: Recife first, then the 6 RPAs (DEC-035)', async () => {
    const res = await get('/territorios').expect(200);

    expect(res.body).toEqual([
      { nome: 'Recife', tipo: 'MUNICIPIO', pai: null },
      { nome: 'RPA 1 - Centro', tipo: 'RPA', pai: 'Recife' },
      { nome: 'RPA 2 - Norte', tipo: 'RPA', pai: 'Recife' },
      { nome: 'RPA 3 - Noroeste', tipo: 'RPA', pai: 'Recife' },
      { nome: 'RPA 4 - Oeste', tipo: 'RPA', pai: 'Recife' },
      { nome: 'RPA 5 - Sudoeste', tipo: 'RPA', pai: 'Recife' },
      { nome: 'RPA 6 - Sul', tipo: 'RPA', pai: 'Recife' },
    ]);
  });

  it('answers 401 without login (PER-010)', async () => {
    await request(app.getHttpServer()).get('/leituras').expect(401);
    await request(app.getHttpServer()).get('/fontes/status').expect(401);
    await request(app.getHttpServer()).get('/territorios').expect(401);
  });
});
