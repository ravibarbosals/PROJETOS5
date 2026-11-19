import request from 'supertest';
import { Papel } from '@/modules/acesso/enums/papel.enum';
import { type AppE2e, criarAppE2e, limparBanco } from './helpers/e2e-app';
import { camposInvalidos } from './helpers/e2e-erro';
import {
  inserirIndicador,
  limparGold,
  registrarColeta,
} from './helpers/e2e-gold';
import { logado } from './helpers/e2e-usuarios';

// MOD-005 (TASK-039), DEC-031, RN-007, PER-010: o GET /indicadores sobre o
// gold de arboviroses, criado com o mesmo SQL da pipeline.
describe('Indicadores de arboviroses (e2e)', () => {
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

  const semanas = async () => {
    for (const [bairro, indicador, periodo, valor] of [
      ['IBURA', 'dengue', '2024-SE52', 7],
      ['IBURA', 'dengue', '2025-SE02', 3],
      ['AGUA FRIA', 'dengue', '2025-SE01', 5],
      ['IBURA', 'zika', '2025-SE01', 1],
    ] as const) {
      await inserirIndicador(app, { bairro, indicador, periodo, valor });
    }
  };

  it('answers the last year with data, ordered, with the source date (RN-007 #1)', async () => {
    const coletadoEm = new Date('2026-11-19T14:30:00.000Z');
    await registrarColeta(app, 'recife_arboviroses', coletadoEm);
    await semanas();

    const res = await get('/indicadores').expect(200);

    expect(res.body).toEqual([
      {
        territorio: 'Recife',
        bairro: 'AGUA FRIA',
        indicador: 'dengue',
        periodo: '2025-SE01',
        valor: 5,
        fonte: 'recife_arboviroses',
        fonte_atualizada_em: coletadoEm.toISOString(),
      },
      expect.objectContaining({ indicador: 'zika', periodo: '2025-SE01' }),
      expect.objectContaining({ bairro: 'IBURA', periodo: '2025-SE02' }),
    ]);
  });

  it('filters by year, disease and neighborhood written with accents', async () => {
    await semanas();

    const porAno = await get('/indicadores?ano=2024').expect(200);
    const porBairro = await get(
      `/indicadores?indicador=dengue&bairro=${encodeURIComponent('Água Fria')}`,
    ).expect(200);

    expect(porAno.body).toEqual([
      expect.objectContaining({ periodo: '2024-SE52', valor: 7 }),
    ]);
    expect(porBairro.body).toEqual([
      expect.objectContaining({ bairro: 'AGUA FRIA', valor: 5 }),
    ]);
  });

  it('answers an empty list without data and a null source date (RN-007 #2)', async () => {
    expect((await get('/indicadores').expect(200)).body).toEqual([]);

    await inserirIndicador(app, {
      bairro: 'IBURA',
      indicador: 'dengue',
      periodo: '2025-SE01',
      valor: 1,
    });
    const [item] = (await get('/indicadores').expect(200)).body as {
      fonte_atualizada_em: unknown;
    }[];
    expect(item.fonte_atualizada_em).toBeNull();
  });

  it('sends a private cache header and answers 304 to the same ETag', async () => {
    await semanas();

    const primeira = await get('/indicadores').expect(200);
    expect(primeira.headers['cache-control']).toBe('private, max-age=300');
    const etag = primeira.headers.etag;
    expect(etag).toBeTruthy();

    await get('/indicadores').set('If-None-Match', etag).expect(304);
  });

  it('answers 422 to an invalid year or disease', async () => {
    expect(
      camposInvalidos(
        await get('/indicadores?ano=1999&indicador=febre'),
      ).sort(),
    ).toEqual(['ano', 'indicador']);
  });

  it('keeps the response time indicator on its own route (MOD-003)', async () => {
    const gin = await logado(app, [Papel.GestaoInstitucional]);

    await request(app.getHttpServer())
      .get(
        '/indicadores/tempo-acionamento?inicio=2026-11-01T00:00:00Z&fim=2026-11-02T00:00:00Z',
      )
      .set('Authorization', `Bearer ${gin.token}`)
      .expect(200);
  });
});
