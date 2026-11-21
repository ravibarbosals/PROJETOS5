import request from 'supertest';
import { DataSource } from 'typeorm';
import { Papel } from '@/modules/acesso/enums/papel.enum';
import { Alerta } from '@/modules/alertas/entities/alerta.entity';
import { AvaliacaoAlertasService } from '@/modules/alertas/avaliacao/services/avaliacao-alertas.service';
import { type AppE2e, criarAppE2e, limparBanco } from './helpers/e2e-app';
import { camposInvalidos, esperarErro } from './helpers/e2e-erro';
import { inserirLeitura, limparGold } from './helpers/e2e-gold';
import { logado } from './helpers/e2e-usuarios';

const NOVO = {
  variavel: 'temperatura_c',
  territorio: 'Recife',
  limiar: 35,
  limiar_saida: 32,
  janela_horas: 1,
  nivel: 'ALTO',
};

interface Parametro {
  id: number;
  limiar: number;
  limiar_saida: number;
  nivel: string;
  ativo: boolean;
}

interface Historico {
  operacao: string;
  valor_anterior: Record<string, unknown> | null;
  valor_novo: Record<string, unknown>;
  autor: { id: number; nome: string };
  registrado_em: string;
}

// MOD-002, RN-001, PER-004, PER-005, DEC-029: o cadastro de parâmetros com o
// histórico gravado no banco de verdade, a trava de linha nas edições
// simultâneas e o job obedecendo à inativação.
describe('Parâmetros de alerta (e2e)', () => {
  let app: AppE2e;
  let ges: Awaited<ReturnType<typeof logado>>;

  beforeAll(async () => {
    app = await criarAppE2e();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await limparBanco(app);
    await limparGold(app);
    ges = await logado(app, [Papel.Gestor]);
  });

  const http = () => request(app.getHttpServer());

  const criar = async (body: object = NOVO, token = ges.token) => {
    const res = await http()
      .post('/parametros-alerta')
      .set('Authorization', `Bearer ${token}`)
      .send(body)
      .expect(201);
    return res.body as Parametro;
  };

  const alterar = (id: number, body: object, token = ges.token) =>
    http()
      .patch(`/parametros-alerta/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  const historico = async (id: number, token = ges.token) => {
    const res = await http()
      .get(`/parametros-alerta/${id}/historico`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    return (res.body as { data: Historico[] }).data;
  };

  it('creates the parameter with a CRIACAO line by the logged manager (RN-001 #1)', async () => {
    const parametro = await criar();

    expect(parametro).toMatchObject({ ...NOVO, ativo: true });
    const [linha] = await historico(parametro.id);
    expect(linha).toMatchObject({
      operacao: 'CRIACAO',
      valor_anterior: null,
      valor_novo: { ...NOVO, ativo: true },
      autor: { id: ges.usuario.id },
    });
  });

  it('records only the changed fields, newest first (RN-001 #2)', async () => {
    const parametro = await criar();

    const res = await alterar(parametro.id, {
      limiar: 38,
      nivel: 'ALTO',
      janela_horas: 3,
    }).expect(200);

    expect(res.body).toMatchObject({ limiar: 38, janela_horas: 3 });
    const linhas = await historico(parametro.id);
    expect(linhas.map((l) => l.operacao)).toEqual(['ALTERACAO', 'CRIACAO']);
    expect(linhas[0]).toMatchObject({
      valor_anterior: { limiar: 35, janela_horas: 1 },
      valor_novo: { limiar: 38, janela_horas: 3 },
    });
  });

  it('writes no history when nothing changes', async () => {
    const parametro = await criar();

    await alterar(parametro.id, { limiar: 35, ativo: true }).expect(200);

    expect(await historico(parametro.id)).toHaveLength(1);
  });

  it('two simultaneous edits each record what they replaced (RN-001, concurrency)', async () => {
    const parametro = await criar();

    await Promise.all([
      alterar(parametro.id, { limiar: 40 }).expect(200),
      alterar(parametro.id, { limiar: 45 }).expect(200),
    ]);

    // As duas podem ter o mesmo milissegundo: a ordem vem do valor anterior.
    const alteracoes = (await historico(parametro.id)).filter(
      (l) => l.operacao === 'ALTERACAO',
    );
    const primeira = alteracoes.find((l) => l.valor_anterior?.limiar === 35);
    const segunda = alteracoes.find((l) => l !== primeira);
    expect(alteracoes).toHaveLength(2);
    expect(segunda?.valor_anterior).toEqual(primeira?.valor_novo);
  });

  it('refuses a territory outside the catalog, saving nothing (DEC-035)', async () => {
    esperarErro(
      await http()
        .post('/parametros-alerta')
        .set('Authorization', `Bearer ${ges.token}`)
        .send({ ...NOVO, territorio: 'Boa Viagem' }),
      {
        status: 422,
        businessRuleCode: 'TERRITORIO_DESCONHECIDO',
        message: 'Território fora do catálogo',
      },
    );
    const res = await http()
      .get('/parametros-alerta')
      .set('Authorization', `Bearer ${ges.token}`)
      .expect(200);
    expect((res.body as { data: Parametro[] }).data).toEqual([]);
  });

  it('creates a parameter for an RPA (DEC-035)', async () => {
    const parametro = await criar({ ...NOVO, territorio: 'RPA 6 - Sul' });

    expect(parametro).toMatchObject({ territorio: 'RPA 6 - Sul' });
  });

  it('refuses an exit threshold not below the threshold, saving nothing (DEC-029)', async () => {
    esperarErro(
      await http()
        .post('/parametros-alerta')
        .set('Authorization', `Bearer ${ges.token}`)
        .send({ ...NOVO, limiar_saida: 35 }),
      { status: 422, businessRuleCode: 'LIMIAR_SAIDA_INVALIDO' },
    );

    const parametro = await criar();
    // Só o limiar muda, mas o par mesclado (30 e 32) fica inválido.
    esperarErro(await alterar(parametro.id, { limiar: 30 }), {
      status: 422,
      businessRuleCode: 'LIMIAR_SAIDA_INVALIDO',
    });
    expect(await historico(parametro.id)).toHaveLength(1);
  });

  it('answers 422 to a variable or territory change and to invalid fields', async () => {
    const parametro = await criar();

    expect(
      camposInvalidos(await alterar(parametro.id, { territorio: 'RPA-1' })),
    ).toEqual(['territorio']);
    expect(
      camposInvalidos(
        await http()
          .post('/parametros-alerta')
          .set('Authorization', `Bearer ${ges.token}`)
          .send({ ...NOVO, nivel: 'BAIXO', janela_horas: 73 }),
      ).sort(),
    ).toEqual(['janela_horas', 'nivel']);
  });

  it('answers 404 to an unknown parameter', async () => {
    esperarErro(await alterar(999_999, { limiar: 40 }), {
      status: 404,
      message: 'Parâmetro não encontrado',
    });
    esperarErro(
      await http()
        .get('/parametros-alerta/999999/historico')
        .set('Authorization', `Bearer ${ges.token}`),
      { status: 404, message: 'Parâmetro não encontrado' },
    );
  });

  it('a deactivated parameter stops firing; reactivated, it fires again (RN-001 #3, RN-012)', async () => {
    const parametro = await criar();
    const job = app.get(AvaliacaoAlertasService);
    const alertas = app.get(DataSource).getRepository(Alerta);

    await alterar(parametro.id, { ativo: false }).expect(200);
    await inserirLeitura(app, {
      variavel: NOVO.variavel,
      valor: 36,
      lidaEm: new Date(Date.now() - 30 * 60_000),
    });
    await job.executar();

    expect(await alertas.count()).toBe(0);
    const [inativacao] = await historico(parametro.id);
    expect(inativacao).toMatchObject({
      operacao: 'INATIVACAO',
      valor_anterior: { ativo: true },
      valor_novo: { ativo: false },
    });

    await alterar(parametro.id, { ativo: true }).expect(200);
    await job.executar();

    expect(await alertas.findBy({ idParametroAlerta: parametro.id })).toEqual([
      expect.objectContaining({ status: 'ATIVO', valorLido: 36 }),
    ]);
  });

  it('lists only the active ones with the filter', async () => {
    const ativo = await criar();
    const inativo = await criar({ ...NOVO, territorio: 'RPA 1 - Centro' });
    await alterar(inativo.id, { ativo: false }).expect(200);

    const res = await http()
      .get('/parametros-alerta?filter.ativo=$eq:true')
      .set('Authorization', `Bearer ${ges.token}`)
      .expect(200);

    expect((res.body as { data: Parametro[] }).data.map((p) => p.id)).toEqual([
      ativo.id,
    ]);
  });

  describe('permissions (PER-004, PER-005)', () => {
    it('the technician reads parameters and history but changes nothing', async () => {
      const parametro = await criar();
      const tec = await logado(app, [Papel.Tecnico]);

      await http()
        .get('/parametros-alerta')
        .set('Authorization', `Bearer ${tec.token}`)
        .expect(200);
      expect(await historico(parametro.id, tec.token)).toHaveLength(1);
      esperarErro(
        await http()
          .post('/parametros-alerta')
          .set('Authorization', `Bearer ${tec.token}`)
          .send(NOVO),
        { status: 403 },
      );
      esperarErro(await alterar(parametro.id, { limiar: 40 }, tec.token), {
        status: 403,
      });
      expect(await historico(parametro.id)).toHaveLength(1);
    });

    it.each([Papel.GestaoInstitucional, Papel.Comunicacao])(
      '%s cannot read them: 403',
      async (papel) => {
        const outro = await logado(app, [papel]);
        esperarErro(
          await http()
            .get('/parametros-alerta')
            .set('Authorization', `Bearer ${outro.token}`),
          { status: 403 },
        );
      },
    );

    it('the administrator may create (PR-023)', async () => {
      const adm = await logado(app, [Papel.Administrador]);

      const parametro = await criar(NOVO, adm.token);

      const [linha] = await historico(parametro.id);
      expect(linha.autor.id).toBe(adm.usuario.id);
    });
  });
});
