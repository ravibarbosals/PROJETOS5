import request from 'supertest';
import { DataSource } from 'typeorm';
import { Papel } from '@/modules/acesso/enums/papel.enum';
import { AlertaAcaoManual } from '@/modules/alertas/entities/alerta-acao-manual.entity';
import { Alerta } from '@/modules/alertas/entities/alerta.entity';
import { StatusAlerta } from '@/modules/alertas/enums/status-alerta.enum';
import { TipoAcaoManual } from '@/modules/alertas/enums/tipo-acao-manual.enum';
import { AvaliacaoAlertasService } from '@/modules/alertas/avaliacao/services/avaliacao-alertas.service';
import { criarAlerta } from './helpers/e2e-alertas';
import { type AppE2e, criarAppE2e, limparBanco } from './helpers/e2e-app';
import { esperarErro } from './helpers/e2e-erro';
import { limparGold } from './helpers/e2e-gold';
import { logado } from './helpers/e2e-usuarios';

const HORA_MS = 3_600_000;
const MOTIVO = 'Chuva parou, confirmado em campo';

interface AlertaRespondido {
  status: string;
  motivo_encerramento: string | null;
  encerrado_em: string | null;
  prorrogado_ate: string | null;
}

// RN-015 #4 a #9, PER-014, PER-015: a ação e a auditoria gravadas juntas no
// banco de verdade, e o job respeitando a prorrogação.
describe('Ações manuais do alerta (e2e)', () => {
  let app: AppE2e;
  let fonte: DataSource;
  let tec: Awaited<ReturnType<typeof logado>>;
  let ges: Awaited<ReturnType<typeof logado>>;

  beforeAll(async () => {
    app = await criarAppE2e();
    fonte = app.get(DataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await limparBanco(app);
    await limparGold(app);
    tec = await logado(app, [Papel.Tecnico]);
    ges = await logado(app, [Papel.Gestor]);
  });

  const agir = (token: string, id: number, acao: string, body: object) =>
    request(app.getHttpServer())
      .post(`/alertas/${id}/${acao}`)
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  const acoesDo = (idAlerta: number) =>
    fonte
      .getRepository(AlertaAcaoManual)
      .find({ where: { idAlerta }, order: { id: 'ASC' } });

  it('closes by hand and records who, why and when (#4, #8)', async () => {
    const alerta = await criarAlerta(app, { disparadoEm: new Date() });
    const antes = Date.now();

    const res = await agir(tec.token, alerta.id, 'encerrar', {
      motivo: `  ${MOTIVO}  `,
    }).expect(200);

    expect(res.body).toMatchObject({
      id: alerta.id,
      status: 'ENCERRADO',
      motivo_encerramento: 'MANUAL',
    });
    const [acao] = await acoesDo(alerta.id);
    expect(acao).toMatchObject({
      idUsuario: tec.usuario.id,
      tipo: TipoAcaoManual.Encerrar,
      motivo: MOTIVO,
      prorrogadoAte: null,
    });
    expect(acao.dthrCriacao.getTime()).toBeGreaterThanOrEqual(antes - 1000);
  });

  it('invalidates, which is a closing with its own reason (#5)', async () => {
    const alerta = await criarAlerta(app, { disparadoEm: new Date() });

    const res = await agir(ges.token, alerta.id, 'invalidar', {
      motivo: 'Sensor da estação com defeito',
    }).expect(200);

    expect(res.body).toMatchObject({
      status: 'ENCERRADO',
      motivo_encerramento: 'INVALIDADO',
    });
    expect((res.body as AlertaRespondido).encerrado_em).not.toBeNull();
    const [acao] = await acoesDo(alerta.id);
    expect(acao.tipo).toBe(TipoAcaoManual.Invalidar);
  });

  it('extends from now and may extend again, keeping it active (#6)', async () => {
    const alerta = await criarAlerta(app, { disparadoEm: new Date() });

    const primeira = await agir(tec.token, alerta.id, 'prorrogar', {
      motivo: MOTIVO,
      horas: 24,
    }).expect(200);
    const antes = Date.now();
    const segunda = await agir(ges.token, alerta.id, 'prorrogar', {
      motivo: 'Nova frente fria a caminho',
      horas: 2,
    }).expect(200);

    const corpo = segunda.body as AlertaRespondido;
    expect(corpo.status).toBe('ATIVO');
    const ate = new Date(corpo.prorrogado_ate as string).getTime();
    expect(ate).toBeGreaterThanOrEqual(antes + 2 * HORA_MS - 1000);
    expect(ate).toBeLessThanOrEqual(Date.now() + 2 * HORA_MS);
    expect(
      new Date((primeira.body as AlertaRespondido).prorrogado_ate as string),
    ).not.toEqual(new Date(corpo.prorrogado_ate as string));

    const acoes = await acoesDo(alerta.id);
    expect(acoes.map((a) => [a.tipo, a.idUsuario])).toEqual([
      [TipoAcaoManual.Prorrogar, tec.usuario.id],
      [TipoAcaoManual.Prorrogar, ges.usuario.id],
    ]);
    expect(acoes[1].prorrogadoAte?.toISOString()).toBe(corpo.prorrogado_ate);
  });

  it('the job does not expire an extended alert (#6, #3)', async () => {
    const seteHorasAtras = new Date(Date.now() - 7 * HORA_MS);
    const expira = await criarAlerta(app, { disparadoEm: seteHorasAtras });
    const prorrogado = await criarAlerta(app, { disparadoEm: seteHorasAtras });
    await agir(tec.token, prorrogado.id, 'prorrogar', {
      motivo: MOTIVO,
      horas: 1,
    }).expect(200);

    await app.get(AvaliacaoAlertasService).executar();

    const repositorio = fonte.getRepository(Alerta);
    expect(await repositorio.findOneByOrFail({ id: expira.id })).toMatchObject({
      status: StatusAlerta.Encerrado,
      motivoEncerramento: 'EXPIRADO',
    });
    expect(
      await repositorio.findOneByOrFail({ id: prorrogado.id }),
    ).toMatchObject({ status: StatusAlerta.Ativo, motivoEncerramento: null });
  });

  it('answers 409 to an alert that is not active, recording nothing (#9)', async () => {
    const alerta = await criarAlerta(app, {
      disparadoEm: new Date(),
      status: StatusAlerta.Encerrado,
    });

    esperarErro(
      await agir(ges.token, alerta.id, 'prorrogar', {
        motivo: MOTIVO,
        horas: 1,
      }),
      { status: 409, businessRuleCode: 'ALERTA_NAO_ATIVO' },
    );
    expect(await acoesDo(alerta.id)).toEqual([]);
  });

  it('answers 409 to a second closing', async () => {
    const alerta = await criarAlerta(app, { disparadoEm: new Date() });
    await agir(tec.token, alerta.id, 'encerrar', { motivo: MOTIVO }).expect(
      200,
    );

    esperarErro(
      await agir(ges.token, alerta.id, 'invalidar', { motivo: MOTIVO }),
      { status: 409, businessRuleCode: 'ALERTA_NAO_ATIVO' },
    );
    expect(await acoesDo(alerta.id)).toHaveLength(1);
  });

  it('answers 404 to an unknown alert', async () => {
    esperarErro(
      await agir(tec.token, 999_999, 'encerrar', { motivo: MOTIVO }),
      {
        status: 404,
        message: 'Alerta não encontrado',
      },
    );
  });

  it('only the manager invalidates: 403 for the technician (PER-015)', async () => {
    const alerta = await criarAlerta(app, { disparadoEm: new Date() });

    esperarErro(
      await agir(tec.token, alerta.id, 'invalidar', { motivo: MOTIVO }),
      { status: 403 },
    );
    expect(await acoesDo(alerta.id)).toEqual([]);
  });
});
