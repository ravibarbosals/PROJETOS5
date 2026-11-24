import request from 'supertest';
import { Papel } from '@/modules/acesso/enums/papel.enum';
import { MotivoEncerramento } from '@/modules/alertas/enums/motivo-encerramento.enum';
import { NivelAlerta } from '@/modules/alertas/enums/nivel-alerta.enum';
import { StatusAlerta } from '@/modules/alertas/enums/status-alerta.enum';
import { criarAlerta, registrarAcaoEm } from './helpers/e2e-alertas';
import { type AppE2e, criarAppE2e, limparBanco } from './helpers/e2e-app';
import { logado } from './helpers/e2e-usuarios';

const horasAtras = (horas: number) =>
  new Date(Date.now() - horas * 60 * 60 * 1000);

// PR-033, PER-016 (TASK-042): o NOT EXISTS sobre as ações só roda num banco de
// verdade.
describe('Decisões pendentes da EST-03 (e2e)', () => {
  let app: AppE2e;
  let token: string;
  let idUsuario: number;

  beforeAll(async () => {
    app = await criarAppE2e();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await limparBanco(app);
    const sessao = await logado(app, [Papel.GestaoInstitucional]);
    token = sessao.token;
    idUsuario = sessao.usuario.id;
  });

  const get = (bearer = token) =>
    request(app.getHttpServer())
      .get('/indicadores/decisoes-pendentes')
      .set('Authorization', `Bearer ${bearer}`);

  it('lists the active alerts without any action, the oldest first', async () => {
    const recente = await criarAlerta(app, {
      disparadoEm: horasAtras(1),
      territorio: 'RPA 6 - Sul',
      variavel: 'precipitacao_mm',
      nivel: NivelAlerta.Alto,
    });
    const antigo = await criarAlerta(app, {
      disparadoEm: horasAtras(5),
      territorio: 'Recife',
      nivel: NivelAlerta.Moderado,
    });
    const comAcao = await criarAlerta(app, { disparadoEm: horasAtras(3) });
    await registrarAcaoEm(app, {
      descricao: 'Equipe acionada',
      idUsuario,
      idAlerta: comAcao.id,
      registradaEm: horasAtras(2),
    });
    await criarAlerta(app, {
      disparadoEm: horasAtras(4),
      status: StatusAlerta.Encerrado,
      motivoEncerramento: MotivoEncerramento.Normalizado,
    });

    const res = await get().expect(200);

    expect(res.body).toEqual({
      total: 2,
      alertas: [
        {
          id: antigo.id,
          variavel: 'chuva_1h',
          territorio: 'Recife',
          nivel: 'MODERADO',
          disparado_em: antigo.dthrDisparo.toISOString(),
        },
        {
          id: recente.id,
          variavel: 'precipitacao_mm',
          territorio: 'RPA 6 - Sul',
          nivel: 'ALTO',
          disparado_em: recente.dthrDisparo.toISOString(),
        },
      ],
    });
  });

  it('is empty without active alerts', async () => {
    const res = await get().expect(200);

    expect(res.body).toEqual({ total: 0, alertas: [] });
  });

  it('answers 403 to Gestor and 401 without login (PER-016)', async () => {
    const { token: gestor } = await logado(app, [Papel.Gestor]);

    await get(gestor).expect(403);
    await request(app.getHttpServer())
      .get('/indicadores/decisoes-pendentes')
      .expect(401);
  });
});
