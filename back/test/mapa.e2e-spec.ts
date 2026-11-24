import request from 'supertest';
import { Papel } from '@/modules/acesso/enums/papel.enum';
import { MotivoEncerramento } from '@/modules/alertas/enums/motivo-encerramento.enum';
import { NivelAlerta } from '@/modules/alertas/enums/nivel-alerta.enum';
import { StatusAlerta } from '@/modules/alertas/enums/status-alerta.enum';
import { criarAlerta } from './helpers/e2e-alertas';
import { type AppE2e, criarAppE2e, limparBanco } from './helpers/e2e-app';
import {
  gravarLimite,
  inserirAreaRisco,
  inserirLeitura,
  inserirPopulacao,
  limparGold,
  registrarColeta,
} from './helpers/e2e-gold';
import { logado } from './helpers/e2e-usuarios';

const horasAtras = (horas: number) =>
  new Date(Date.now() - horas * 60 * 60 * 1000);

interface RpaMapa {
  nome: string;
  rpa: number;
  limite: unknown;
  populacao: number | null;
  chuva_24h_mm: number | null;
  alerta_nivel: string | null;
  prioridade: number | null;
}

// MOD-005, DEC-038, DEC-034, PR-030, PER-011 (TASK-062). As somas e o join
// com os alertas só rodam num banco de verdade.
describe('Mapa da EST-01 (e2e)', () => {
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
    ({ token } = await logado(app, [Papel.Tecnico]));
  });

  const get = () =>
    request(app.getHttpServer())
      .get('/mapa')
      .set('Authorization', `Bearer ${token}`);

  const rpa = async (numero: number): Promise<RpaMapa> => {
    const res = await get().expect(200);
    return (res.body as { rpas: RpaMapa[] }).rpas[numero - 1];
  };

  it('lists the 6 RPAs in order, empty while the pipeline has not run', async () => {
    const res = await get().expect(200);

    expect(res.body).toEqual({
      rpas: [
        'RPA 1 - Centro',
        'RPA 2 - Norte',
        'RPA 3 - Noroeste',
        'RPA 4 - Oeste',
        'RPA 5 - Sudoeste',
        'RPA 6 - Sul',
      ].map((nome, i) => ({
        nome,
        rpa: i + 1,
        limite: null,
        populacao: null,
        chuva_24h_mm: null,
        alerta_nivel: null,
        prioridade: null,
      })),
      areas_risco: [],
      fontes: [],
    });
  });

  it('brings the RPA boundary and the population summed by bairro (PR-030)', async () => {
    const limite = {
      type: 'MultiPolygon',
      coordinates: [
        [
          [
            [-34.95, -8.12],
            [-34.94, -8.12],
            [-34.94, -8.11],
            [-34.95, -8.12],
          ],
        ],
      ],
    };
    await gravarLimite(app, 6, limite);
    await inserirPopulacao(app, 'IBURA', 50_000);
    await inserirPopulacao(app, 'JORDAO', 20_000);
    await inserirPopulacao(app, 'SANTO AMARO', 27_103);

    expect(await rpa(6)).toEqual(
      expect.objectContaining({ limite, populacao: 70_000 }),
    );
    expect((await rpa(1)).populacao).toBe(27_103);
  });

  it('rain: accumulates 24h per station and keeps the largest (DEC-034)', async () => {
    const chuva = (estacao: string, valor: number, horas: number) =>
      inserirLeitura(app, {
        estacao,
        territorio: 'RPA 2 - Norte',
        variavel: 'precipitacao_mm',
        valor,
        lidaEm: horasAtras(horas),
      });
    await chuva('a', 3, 1);
    await chuva('a', 4.5, 10);
    await chuva('a', 50, 30);
    await chuva('b', 6, 2);
    await inserirLeitura(app, {
      estacao: 'a',
      territorio: 'RPA 2 - Norte',
      variavel: 'temperatura_c',
      valor: 30,
      lidaEm: horasAtras(1),
    });

    expect((await rpa(2)).chuva_24h_mm).toBe(7.5);
    expect((await rpa(3)).chuva_24h_mm).toBeNull();
  });

  it('alert: the highest active level of the RPA itself (DEC-029)', async () => {
    const disparadoEm = horasAtras(1);
    await criarAlerta(app, {
      disparadoEm,
      territorio: 'RPA 4 - Oeste',
      nivel: NivelAlerta.Moderado,
    });
    await criarAlerta(app, {
      disparadoEm,
      territorio: 'RPA 4 - Oeste',
      variavel: 'precipitacao_mm',
      nivel: NivelAlerta.Alto,
    });
    await criarAlerta(app, {
      disparadoEm,
      territorio: 'RPA 5 - Sudoeste',
      nivel: NivelAlerta.Moderado,
    });
    await criarAlerta(app, {
      disparadoEm,
      territorio: 'RPA 6 - Sul',
      nivel: NivelAlerta.Alto,
      status: StatusAlerta.Encerrado,
      motivoEncerramento: MotivoEncerramento.Normalizado,
    });
    await criarAlerta(app, {
      disparadoEm,
      territorio: 'Recife',
      nivel: NivelAlerta.Alto,
    });

    const res = await get().expect(200);

    expect(
      (res.body as { rpas: RpaMapa[] }).rpas.map((r) => r.alerta_nivel),
    ).toEqual([null, null, null, 'ALTO', 'MODERADO', null]);
  });

  it('priority: RPAs with an active alert, largest population first; a Recife alert marks none (RN-016)', async () => {
    await inserirPopulacao(app, 'SANTO AMARO', 27_103);
    await inserirPopulacao(app, 'IBURA', 50_000);
    await inserirPopulacao(app, 'JORDAO', 20_000);
    await inserirPopulacao(app, 'BOA VIAGEM', 120_000);
    const disparadoEm = horasAtras(1);
    for (const territorio of ['RPA 1 - Centro', 'RPA 6 - Sul']) {
      await criarAlerta(app, { disparadoEm, territorio });
    }
    await criarAlerta(app, {
      disparadoEm,
      territorio: 'RPA 3 - Noroeste',
      nivel: NivelAlerta.Moderado,
    });
    await criarAlerta(app, { disparadoEm, territorio: 'Recife' });

    const res = await get().expect(200);

    expect(
      (res.body as { rpas: RpaMapa[] }).rpas.map((r) => [
        r.populacao,
        r.prioridade,
      ]),
    ).toEqual([
      [27_103, 2],
      [null, null],
      [null, 3],
      [null, null],
      [null, null],
      [190_000, 1],
    ]);
  });

  it('lists the risk points and the dates of the map sources (RN-007)', async () => {
    await inserirAreaRisco(app, {
      territorio: 'RPA 6 - Sul',
      bairro: 'JORDAO',
      nivel: 3,
      latitude: -8.128689,
      longitude: -34.950349,
    });
    await inserirAreaRisco(app, {
      territorio: 'RPA 6 - Sul',
      bairro: 'IBURA',
      nivel: null,
      latitude: -8.12,
      longitude: -34.94,
    });
    const coletadoEm = horasAtras(2);
    await registrarColeta(app, 'recife_areas_risco', coletadoEm);
    await registrarColeta(app, 'recife_arboviroses', coletadoEm);

    const res = await get().expect(200);

    expect(res.body).toEqual(
      expect.objectContaining({
        areas_risco: [
          expect.objectContaining({ bairro: 'IBURA', nivel: null }),
          {
            id: expect.any(Number) as number,
            territorio: 'RPA 6 - Sul',
            bairro: 'JORDAO',
            localidade: 'Localidade E2E',
            endereco: 'Rua E2E, 1',
            descricao: 'Área de Risco E2E',
            nivel: 3,
            latitude: -8.128689,
            longitude: -34.950349,
          },
        ],
        fontes: [
          {
            fonte: 'recife_areas_risco',
            ultima_atualizacao: coletadoEm.toISOString(),
          },
        ],
      }),
    );
  });

  it('answers 403 to Comunicação and 401 without login (PER-011)', async () => {
    const { token: comunicacao } = await logado(app, [Papel.Comunicacao]);

    await request(app.getHttpServer())
      .get('/mapa')
      .set('Authorization', `Bearer ${comunicacao}`)
      .expect(403);
    await request(app.getHttpServer()).get('/mapa').expect(401);
  });
});
