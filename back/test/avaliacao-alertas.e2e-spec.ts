import { DataSource } from 'typeorm';
import { Alerta } from '@/modules/alertas/entities/alerta.entity';
import { ControleAvaliacaoAlerta } from '@/modules/alertas/entities/controle-avaliacao-alerta.entity';
import { ParametroAlerta } from '@/modules/alertas/entities/parametro-alerta.entity';
import { MotivoEncerramento } from '@/modules/alertas/enums/motivo-encerramento.enum';
import { NivelAlerta } from '@/modules/alertas/enums/nivel-alerta.enum';
import { StatusAlerta } from '@/modules/alertas/enums/status-alerta.enum';
import { AvaliacaoAlertasService } from '@/modules/alertas/avaliacao/services/avaliacao-alertas.service';
import { type AppE2e, criarAppE2e, limparBanco } from './helpers/e2e-app';
import { inserirLeitura, limparGold } from './helpers/e2e-gold';

const AGORA = new Date('2026-11-19T12:00:00Z');
const horas = (h: number) => new Date(AGORA.getTime() + h * 60 * 60 * 1000);

// FLX-002, RN-012, RN-013, RN-015, DEC-015: o job sobre o gold e o schema app
// de verdade, com o relógio passado como parâmetro.
describe('Avaliação de alertas (e2e)', () => {
  let app: AppE2e;
  let avaliacao: AvaliacaoAlertasService;
  let fonte: DataSource;

  beforeAll(async () => {
    app = await criarAppE2e();
    avaliacao = app.get(AvaliacaoAlertasService);
    fonte = app.get(DataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await limparBanco(app);
    await limparGold(app);
    // Chuva acumulada em 3 h: MODERADO a partir de 30 mm, ALTO a partir de 50.
    await fonte.getRepository(ParametroAlerta).save([
      {
        variavel: 'precipitacao_mm',
        territorio: 'Recife',
        limiar: 30,
        limiarSaida: 10,
        janelaHoras: 3,
        nivel: NivelAlerta.Moderado,
      },
      {
        variavel: 'precipitacao_mm',
        territorio: 'Recife',
        limiar: 50,
        limiarSaida: 20,
        janelaHoras: 3,
        nivel: NivelAlerta.Alto,
      },
    ]);
  });

  const chuva = (h: number, valor: number) =>
    inserirLeitura(app, {
      variavel: 'precipitacao_mm',
      valor,
      lidaEm: horas(h),
    });
  const alertas = () =>
    fonte.getRepository(Alerta).find({ order: { id: 'ASC' } });

  it('fires once with the reading data and is idempotent (RN-012 #1, RN-013 #1)', async () => {
    await chuva(-2, 12);
    await chuva(-1, 12);
    await chuva(0, 12);

    expect(await avaliacao.executar(AGORA)).toMatchObject({ DISPARAR: 1 });
    expect(await avaliacao.executar(AGORA)).toMatchObject({
      DISPARAR: 0,
      ATUALIZAR: 1,
    });

    const [alerta, ...outros] = await alertas();
    expect(outros).toHaveLength(0);
    expect(alerta).toMatchObject({
      variavel: 'precipitacao_mm',
      territorio: 'Recife',
      nivel: NivelAlerta.Moderado,
      limiar: 30,
      fonte: 'openmeteo',
      estacao: 'recife',
      valorLido: 36,
      valorMaximo: 36,
      lidaEm: horas(0),
      status: StatusAlerta.Ativo,
    });
    const controle = await fonte
      .getRepository(ControleAvaliacaoAlerta)
      .findOneByOrFail({});
    expect(controle.ultimaLidaEm).toEqual(horas(0));
  });

  it('Recife takes the RPA station with the most rain, not the sum of the stations (DEC-034)', async () => {
    const naRpa =
      (estacao: string, territorio: string) => (h: number, valor: number) =>
        inserirLeitura(app, {
          estacao,
          territorio,
          variavel: 'precipitacao_mm',
          valor,
          lidaEm: horas(h),
        });
    const centro = naRpa('rpa1', 'RPA 1 - Centro');
    const sul = naRpa('rpa6', 'RPA 6 - Sul');
    // 3 h: Centro soma 20, Sul soma 32. Somadas dariam 52 (ALTO).
    await centro(-1, 10);
    await centro(0, 10);
    await sul(-1, 30);
    await sul(0, 2);

    expect(await avaliacao.executar(AGORA)).toMatchObject({ DISPARAR: 1 });

    const [alerta] = await alertas();
    expect(alerta).toMatchObject({
      territorio: 'Recife',
      nivel: NivelAlerta.Moderado,
      estacao: 'rpa6',
      valorLido: 32,
    });
  });

  it('an RPA parameter does not see the other RPAs (DEC-035)', async () => {
    await fonte.getRepository(ParametroAlerta).save({
      variavel: 'precipitacao_mm',
      territorio: 'RPA 1 - Centro',
      limiar: 30,
      limiarSaida: 10,
      janelaHoras: 3,
      nivel: NivelAlerta.Moderado,
    });
    await inserirLeitura(app, {
      estacao: 'rpa6',
      territorio: 'RPA 6 - Sul',
      variavel: 'precipitacao_mm',
      valor: 40,
      lidaEm: horas(0),
    });

    await avaliacao.executar(AGORA);

    expect((await alertas()).map((a) => a.territorio)).toEqual(['Recife']);
  });

  it('escalates the same alert to ALTO (RN-012 #5)', async () => {
    await chuva(-1, 15);
    await chuva(0, 20);
    await avaliacao.executar(AGORA);

    await chuva(1, 25);
    await avaliacao.executar(horas(1));

    const [alerta, ...outros] = await alertas();
    expect(outros).toHaveLength(0);
    expect(alerta).toMatchObject({
      nivel: NivelAlerta.Alto,
      limiar: 50,
      valorLido: 35,
      valorMaximo: 60,
      ultimaLeituraEm: horas(1),
    });
    expect(alerta.dthrEscalonamento).toEqual(horas(1));
  });

  it('closes as NORMALIZADO after 2 h below the exit threshold (RN-015 #1)', async () => {
    await chuva(-3, 40);
    await avaliacao.executar(horas(-3));

    for (const h of [-2, -1, 0, 1, 2, 3]) await chuva(h, 0);
    await avaliacao.executar(horas(1));
    expect((await alertas())[0].status).toBe(StatusAlerta.Ativo);

    await avaliacao.executar(horas(3));
    expect(await alertas()).toMatchObject([
      {
        status: StatusAlerta.Encerrado,
        motivoEncerramento: MotivoEncerramento.Normalizado,
        dthrEncerramento: horas(3),
      },
    ]);
  });

  it('expires without readings and does not fire again on old ones (RN-015 #3, #10)', async () => {
    await chuva(0, 40);
    await avaliacao.executar(AGORA);

    await avaliacao.executar(horas(6));
    await avaliacao.executar(horas(7));

    expect(await alertas()).toMatchObject([
      {
        status: StatusAlerta.Encerrado,
        motivoEncerramento: MotivoEncerramento.Expirado,
      },
    ]);
  });

  it('does nothing while another instance holds the lock', async () => {
    await chuva(0, 40);
    const outra = fonte.createQueryRunner();
    await outra.startTransaction();
    await outra.query(
      "SELECT pg_advisory_xact_lock(hashtext('vigia:avaliacao-alertas'))",
    );

    try {
      expect(await avaliacao.executar(AGORA)).toBeNull();
    } finally {
      await outra.rollbackTransaction();
      await outra.release();
    }
    expect(await alertas()).toHaveLength(0);
  });
});
