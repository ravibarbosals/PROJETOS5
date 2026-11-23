import { DataSource } from 'typeorm';
import {
  type Email,
  EmailService,
} from '@/infrastructure/email/services/email.service';
import { Papel } from '@/modules/acesso/enums/papel.enum';
import { AvaliacaoAlertasService } from '@/modules/alertas/avaliacao/services/avaliacao-alertas.service';
import { Alerta } from '@/modules/alertas/entities/alerta.entity';
import { ParametroAlerta } from '@/modules/alertas/entities/parametro-alerta.entity';
import { NivelAlerta } from '@/modules/alertas/enums/nivel-alerta.enum';
import { EventoAlerta } from '@/modules/alertas/notificacao/domain/email-do-alerta';
import { NotificacaoAlertaService } from '@/modules/alertas/notificacao/services/notificacao-alerta.service';
import { type AppE2e, criarAppE2e, limparBanco } from './helpers/e2e-app';
import { criarAlerta } from './helpers/e2e-alertas';
import { inserirLeitura, limparGold } from './helpers/e2e-gold';
import { criarUsuario } from './helpers/e2e-usuarios';

const AGORA = new Date('2026-11-21T12:00:00Z');
const horas = (h: number) => new Date(AGORA.getTime() + h * 60 * 60 * 1000);

// PR-027, PR-029, DEC-037: quando o job avisa e para quem vai o e-mail, sobre
// o banco de verdade, com o SMTP trocado por um espião.
describe('Notificação de alertas por e-mail (e2e)', () => {
  let app: AppE2e;
  let fonte: DataSource;
  let enviar: jest.SpyInstance<Promise<void>, [Email]>;

  beforeAll(async () => {
    app = await criarAppE2e();
    fonte = app.get(DataSource);
    const email = app.get(EmailService);
    jest.spyOn(email, 'habilitado', 'get').mockReturnValue(true);
    enviar = jest.spyOn(email, 'enviar').mockResolvedValue(undefined);
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    await app.close();
  });

  beforeEach(async () => {
    enviar.mockClear();
    await limparBanco(app);
    await limparGold(app);
  });

  it('sends the alert to every active user of any role, never to inactive ones (PR-029)', async () => {
    await criarUsuario(app, [Papel.Gestor], { email: 'gestor@e2e.gov.br' });
    await criarUsuario(app, [Papel.Comunicacao], {
      email: 'comunicacao@e2e.gov.br',
    });
    await criarUsuario(app, [Papel.Tecnico], {
      email: 'inativo@e2e.gov.br',
      ativo: false,
    });
    const alerta = await criarAlerta(app, {
      disparadoEm: AGORA,
      territorio: 'RPA 6 - Sul',
      variavel: 'precipitacao_mm',
      nivel: NivelAlerta.Alto,
    });

    await app
      .get(NotificacaoAlertaService)
      .notificar([{ idAlerta: alerta.id, evento: EventoAlerta.Disparo }]);

    const enviados = enviar.mock.calls.map(([e]) => e);
    expect(enviados.map((e) => e.para)).toEqual([
      'gestor@e2e.gov.br',
      'comunicacao@e2e.gov.br',
    ]);
    expect(enviados[0].assunto).toBe(
      '[O Vigia] Alerta ALTO: Precipitação em RPA 6 - Sul',
    );
  });

  it('the job notifies on firing and on escalation, not on a plain re-evaluation (DEC-037)', async () => {
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
    const chuva = (h: number, valor: number) =>
      inserirLeitura(app, {
        variavel: 'precipitacao_mm',
        valor,
        lidaEm: horas(h),
      });
    const avaliacao = app.get(AvaliacaoAlertasService);
    // Só o que o job pede; o envio em si é o teste acima.
    const notificar = jest
      .spyOn(app.get(NotificacaoAlertaService), 'notificar')
      .mockResolvedValue(undefined);

    try {
      await chuva(-1, 15);
      await chuva(0, 20);
      await avaliacao.executar(AGORA);
      await avaliacao.executar(AGORA);
      await chuva(1, 25);
      await avaliacao.executar(horas(1));

      const [alerta] = await fonte.getRepository(Alerta).find();
      expect(notificar.mock.calls.map(([avisos]) => avisos)).toEqual([
        [{ idAlerta: alerta.id, evento: EventoAlerta.Disparo }],
        [],
        [{ idAlerta: alerta.id, evento: EventoAlerta.Escalonamento }],
      ]);
    } finally {
      notificar.mockRestore();
    }
  });
});
