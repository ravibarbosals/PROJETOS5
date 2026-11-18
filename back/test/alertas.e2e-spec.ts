import request from 'supertest';
import { Papel } from '@/modules/acesso/enums/papel.enum';
import { type AppE2e, criarAppE2e, limparBanco } from './helpers/e2e-app';
import { criarAlerta } from './helpers/e2e-alertas';
import { limparGold, registrarColeta } from './helpers/e2e-gold';
import { logado } from './helpers/e2e-usuarios';

interface AlertaListado {
  fonte: string;
  fonte_atualizada_em: string | null;
}

// MOD-002, RN-007. The source date comes from the gold view, on a real database.
describe('Alertas (e2e)', () => {
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
    ({ token } = await logado(app, [Papel.Gestor]));
  });

  const listar = async () => {
    const res = await request(app.getHttpServer())
      .get('/alertas')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    return (res.body as { data: AlertaListado[] }).data;
  };

  it('answers the last successful collection of the source (RN-007 #1)', async () => {
    const coletadoEm = new Date('2026-11-18T12:00:00Z');
    await registrarColeta(app, 'APAC', new Date('2026-11-18T11:00:00Z'));
    await registrarColeta(app, 'APAC', coletadoEm);
    await criarAlerta(app, { disparadoEm: new Date('2026-11-18T12:05:00Z') });

    const [alerta] = await listar();

    expect(alerta).toMatchObject({
      fonte: 'APAC',
      fonte_atualizada_em: coletadoEm.toISOString(),
    });
  });

  it('answers null when the source was never collected (RN-007 #2)', async () => {
    await registrarColeta(app, 'openmeteo', new Date('2026-11-18T12:00:00Z'));
    await criarAlerta(app, { disparadoEm: new Date('2026-11-18T12:05:00Z') });

    const [alerta] = await listar();

    expect(alerta.fonte_atualizada_em).toBeNull();
  });
});
