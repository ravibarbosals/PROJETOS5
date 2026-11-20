import request from 'supertest';
import { DataSource } from 'typeorm';
import { seedDemo } from '@/infrastructure/database/seed-demo/seed-demo';
import { PasswordHasher } from '@/modules/acesso/services/password-hasher.service';
import { AvaliacaoAlertasService } from '@/modules/alertas/avaliacao/services/avaliacao-alertas.service';
import { Alerta } from '@/modules/alertas/entities/alerta.entity';
import { ParametroAlerta } from '@/modules/alertas/entities/parametro-alerta.entity';
import { MotivoEncerramento } from '@/modules/alertas/enums/motivo-encerramento.enum';
import { NivelAlerta } from '@/modules/alertas/enums/nivel-alerta.enum';
import { StatusAlerta } from '@/modules/alertas/enums/status-alerta.enum';
import { type AppE2e, criarAppE2e, limparBanco } from './helpers/e2e-app';
import { inserirLeitura, limparGold } from './helpers/e2e-gold';
import { entrar } from './helpers/e2e-usuarios';

const AGORA = new Date('2026-11-20T15:37:00Z');
const HORA_MS = 3_600_000;
const SENHA = 'senha-demo-1';

// TASK-050 contra o banco de verdade: o seed, o login dos usuários de
// demonstração, o indicador da EST-03 e o job de alertas sobre o --ativo.
describe('Seed de demonstração (e2e)', () => {
  let app: AppE2e;
  let fonte: DataSource;

  const rodar = (ativo = false, agora = AGORA) =>
    seedDemo(fonte, app.get(PasswordHasher), { senha: SENHA, ativo, agora });

  const contar = async () => {
    const tabelas = [
      'usuario',
      'parametro_alerta',
      'parametro_alerta_historico',
      'alerta',
      'alerta_acao_manual',
      'acao',
    ];
    const contagens: Record<string, number> = {};
    for (const t of tabelas) {
      const [{ n }] = await fonte.query<{ n: number }[]>(
        `SELECT count(*)::int AS n FROM app.${t}`,
      );
      contagens[t] = n;
    }
    return contagens;
  };

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
  });

  it('creates the demo data once and does nothing on the second run', async () => {
    await expect(rodar()).resolves.toEqual({ base: 'criado' });
    const depois = await contar();
    expect(depois).toEqual({
      usuario: 4,
      parametro_alerta: 4,
      parametro_alerta_historico: 6,
      alerta: 6,
      alerta_acao_manual: 3,
      acao: 9,
    });

    await expect(rodar()).resolves.toEqual({ base: 'ja-existe' });
    expect(await contar()).toEqual(depois);
  });

  it('keeps the dates relative to now', async () => {
    await rodar();
    const [{ min, max }] = await fonte.query<{ min: Date; max: Date }[]>(
      'SELECT min(dthr_disparo) AS min, max(dthr_encerramento) AS max FROM app.alerta',
    );
    expect(AGORA.getTime() - min.getTime()).toBeLessThanOrEqual(
      27 * 24 * HORA_MS,
    );
    expect(max.getTime()).toBeLessThan(AGORA.getTime());

    // "Atualizado em" dos parâmetros vem do histórico, não da hora do seed.
    const [{ atualizado }] = await fonte.query<{ atualizado: Date }[]>(
      'SELECT max(dthr_atualizacao) AS atualizado FROM app.parametro_alerta',
    );
    expect(AGORA.getTime() - atualizado.getTime()).toBeGreaterThanOrEqual(
      15 * 24 * HORA_MS,
    );
  });

  it('refuses a database that already has parameters', async () => {
    await fonte.getRepository(ParametroAlerta).save({
      variavel: 'precipitacao_mm',
      territorio: 'Recife',
      limiar: 40,
      limiarSaida: 10,
      janelaHoras: 24,
      nivel: NivelAlerta.Moderado,
    });

    await expect(rodar()).rejects.toThrow('banco sem parâmetros');
    expect((await contar()).usuario).toBe(0);
  });

  it('lets the demo users sign in with DEMO_SENHA', async () => {
    await rodar();
    await expect(
      entrar(app, 'gestao@demo.vigia.local', SENHA),
    ).resolves.toEqual(expect.any(String));
  });

  it('feeds the response time indicator of EST-03 (REQ-018)', async () => {
    await rodar();
    const token = await entrar(app, 'gestao@demo.vigia.local', SENHA);

    const res = await request(app.getHttpServer())
      .get('/indicadores/tempo-acionamento')
      .query({
        inicio: new Date(AGORA.getTime() - 30 * 24 * HORA_MS).toISOString(),
        fim: AGORA.toISOString(),
      })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    // 12, 40, 8 e 25 minutos; o invalidado não conta e o expirado ficou sem ação.
    expect(res.body).toMatchObject({
      media_segundos: 1275,
      alertas_com_acao: 4,
      alertas_sem_acao: 1,
    });
  });

  describe('--ativo', () => {
    const ativoDeChuva = () =>
      fonte.getRepository(Alerta).findOneBy({
        variavel: 'precipitacao_mm',
        status: StatusAlerta.Ativo,
      });

    it('applies the base if needed and adds one active alert', async () => {
      await expect(rodar(true)).resolves.toEqual({
        base: 'criado',
        ativo: 'criado',
      });
      expect(await ativoDeChuva()).toMatchObject({
        nivel: NivelAlerta.Moderado,
        prorrogadoAte: new Date(AGORA.getTime() + 8 * HORA_MS),
      });
    });

    it('does not create a second active alert (RN-013)', async () => {
      await rodar(true);
      const depois = await contar();

      await expect(rodar(true)).resolves.toEqual({
        base: 'ja-existe',
        ativo: 'ja-existe',
      });
      expect(await contar()).toEqual(depois);
    });

    it('survives the job while extended, then the job closes it', async () => {
      await rodar(true);
      // Tempo seco de verdade: 12 h de leituras sem chuva até 9 h depois.
      for (let h = -3; h <= 9; h++) {
        await inserirLeitura(app, {
          variavel: 'precipitacao_mm',
          valor: 0,
          lidaEm: new Date(
            Math.floor(AGORA.getTime() / HORA_MS) * HORA_MS + h * HORA_MS,
          ),
        });
      }
      const avaliacao = app.get(AvaliacaoAlertasService);

      await avaliacao.executar(new Date(AGORA.getTime() + 2 * HORA_MS));
      expect(await ativoDeChuva()).not.toBeNull();

      await avaliacao.executar(new Date(AGORA.getTime() + 9 * HORA_MS));
      expect(await ativoDeChuva()).toBeNull();
      const [encerrado] = await fonte.getRepository(Alerta).find({
        where: { variavel: 'precipitacao_mm' },
        order: { dthrDisparo: 'DESC' },
        take: 1,
      });
      expect(encerrado.motivoEncerramento).toBe(MotivoEncerramento.Normalizado);
    });
  });
});
