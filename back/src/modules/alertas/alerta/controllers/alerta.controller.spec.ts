import { INestApplication } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { GlobalExceptionFilter } from '@/core/exceptions/global-exception.filter';
import { createValidationPipe } from '@/core/pipes/validation.pipe';
import { UsuarioPapel } from '@/modules/acesso/entities/usuario-papel.entity';
import { Usuario } from '@/modules/acesso/entities/usuario.entity';
import { Papel } from '@/modules/acesso/enums/papel.enum';
import { AuthGuard } from '@/modules/acesso/guards/auth.guard';
import { UsuarioService } from '@/modules/acesso/usuario/services/usuario.service';
import { AlertaController } from '@/modules/alertas/alerta/controllers/alerta.controller';
import { Alerta } from '@/modules/alertas/entities/alerta.entity';
import { StatusAlerta } from '@/modules/alertas/enums/status-alerta.enum';
import { TipoAcaoManual } from '@/modules/alertas/enums/tipo-acao-manual.enum';
import { AlertaService } from '@/modules/alertas/alerta/services/alerta.service';
import { FonteStatusService } from '@/modules/paineis/fonte-status/services/fonte-status.service';

const PAPEIS: Papel[] = [
  Papel.Tecnico,
  Papel.Gestor,
  Papel.GestaoInstitucional,
  Papel.Comunicacao,
  Papel.Administrador,
];

const USUARIOS: Record<number, Usuario> = Object.fromEntries(
  PAPEIS.map((papel, i) => [
    i + 1,
    Object.assign(new Usuario(), {
      id: i + 1,
      nome: papel,
      ativo: true,
      papeis: [Object.assign(new UsuarioPapel(), { papel })],
    }),
  ]),
);

const ALERTA = Object.assign(new Alerta(), {
  id: 10,
  idParametroAlerta: 3,
  variavel: 'chuva_1h',
  territorio: 'RPA-1',
  limiar: 50,
  nivel: 'ALTO',
  fonte: 'APAC',
  estacao: 'REC-01',
  valorLido: 62.5,
  valorMaximo: 71.2,
  ultimaLeituraEm: new Date('2026-10-24T13:00:00Z'),
  dthrEscalonamento: new Date('2026-10-24T11:05:00Z'),
  lidaEm: new Date('2026-10-24T10:00:00Z'),
  status: StatusAlerta.Ativo,
  dthrDisparo: new Date('2026-10-24T10:05:00Z'),
  dthrEncerramento: null,
  motivoEncerramento: null,
  prorrogadoAte: null,
});

const MOTIVO = 'Chuva parou, confirmado em campo';

// PER-006 e o contrato do MOD-002, com o guard, o pipe e o filtro reais.
describe('AlertaController', () => {
  let app: INestApplication<App>;
  const tokens: Record<number, string> = {};
  const service = { listar: jest.fn(), agir: jest.fn() };
  const fontes = { ultimaAtualizacaoPorFonte: jest.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'x'.repeat(32) })],
      controllers: [AlertaController],
      providers: [
        { provide: AlertaService, useValue: service },
        { provide: FonteStatusService, useValue: fontes },
        {
          provide: UsuarioService,
          useValue: {
            buscarAutenticado: (id: number) => Promise.resolve(USUARIOS[id]),
          },
        },
        { provide: APP_GUARD, useClass: AuthGuard },
        { provide: APP_PIPE, useFactory: createValidationPipe },
        { provide: APP_FILTER, useValue: new GlobalExceptionFilter(false) },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    const jwt = moduleRef.get(JwtService);
    for (const id of Object.keys(USUARIOS)) {
      tokens[Number(id)] = await jwt.signAsync({ sub: Number(id) });
    }
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    service.listar.mockReset();
    service.listar.mockResolvedValue({
      data: [ALERTA],
      meta: { itemsPerPage: 20, totalItems: 1, currentPage: 1, totalPages: 1 },
      links: { current: '/alertas?page=1' },
    });
    service.agir.mockReset();
    service.agir.mockResolvedValue(ALERTA);
    fontes.ultimaAtualizacaoPorFonte.mockReset();
    fontes.ultimaAtualizacaoPorFonte.mockResolvedValue(new Map());
  });

  const get = (id: number) =>
    request(app.getHttpServer())
      .get('/alertas')
      .set('Authorization', `Bearer ${tokens[id]}`);

  it('answers 401 without login', async () => {
    await request(app.getHttpServer()).get('/alertas').expect(401);
  });

  it.each([
    [1, 'TEC'],
    [2, 'GES'],
    [3, 'GIN'],
    [5, 'ADM, PR-023'],
  ])('lists alerts for user %i (%s, PER-006)', async (id) => {
    await get(id).expect(200);
  });

  it('answers 403 for COM (PER-006; DUV-036, denied until answered)', async () => {
    await get(4).expect(403);
    expect(service.listar).not.toHaveBeenCalled();
  });

  it('answers the MOD-002 contract with the update time of the source (RN-007 #1)', async () => {
    fontes.ultimaAtualizacaoPorFonte.mockResolvedValue(
      new Map([['APAC', new Date('2026-10-24T10:30:00Z')]]),
    );

    const response = await get(2).expect(200);

    expect((response.body as { data: unknown[] }).data).toEqual([
      {
        id: 10,
        nivel: 'ALTO',
        parametro: { id: 3, variavel: 'chuva_1h', limiar: 50 },
        territorio: 'RPA-1',
        valor_lido: 62.5,
        valor_maximo: 71.2,
        fonte: 'APAC',
        lida_em: '2026-10-24T10:00:00.000Z',
        ultima_leitura_em: '2026-10-24T13:00:00.000Z',
        disparado_em: '2026-10-24T10:05:00.000Z',
        escalonado_em: '2026-10-24T11:05:00.000Z',
        fonte_atualizada_em: '2026-10-24T10:30:00.000Z',
        status: 'ATIVO',
        prorrogado_ate: null,
        encerrado_em: null,
        motivo_encerramento: null,
      },
    ]);
  });

  it('answers null when the source was never collected (RN-007 #2)', async () => {
    const response = await get(2).expect(200);

    const [alerta] = (
      response.body as { data: { fonte_atualizada_em: unknown }[] }
    ).data;
    expect(alerta.fonte_atualizada_em).toBeNull();
  });

  // Só prorrogar aceita o prazo: campo a mais dá 422 (DEC-010).
  const corpo = (acao: string) =>
    acao === 'prorrogar' ? { motivo: MOTIVO, horas: 2 } : { motivo: MOTIVO };

  const post = (id: number, acao: string, body: object) =>
    request(app.getHttpServer())
      .post(`/alertas/10/${acao}`)
      .set('Authorization', `Bearer ${tokens[id]}`)
      .send(body);

  describe('manual actions (RN-015)', () => {
    it.each([
      [1, 'encerrar'],
      [2, 'encerrar'],
      [5, 'encerrar'],
      [1, 'prorrogar'],
      [2, 'prorrogar'],
      [5, 'prorrogar'],
      [2, 'invalidar'],
      [5, 'invalidar'],
    ])('user %i may %s (PER-014, PER-015)', async (id, acao) => {
      await post(id, acao, corpo(acao)).expect(200);
    });

    it.each([
      [3, 'encerrar'],
      [4, 'encerrar'],
      [3, 'prorrogar'],
      [4, 'prorrogar'],
      [1, 'invalidar'],
      [3, 'invalidar'],
      [4, 'invalidar'],
    ])('user %i may not %s (PER-014, PER-015)', async (id, acao) => {
      await post(id, acao, corpo(acao)).expect(403);
      expect(service.agir).not.toHaveBeenCalled();
    });

    it('passes the action, the trimmed reason and the logged user', async () => {
      await post(2, 'prorrogar', { motivo: `  ${MOTIVO}  `, horas: 3 }).expect(
        200,
      );

      expect(service.agir).toHaveBeenCalledWith(
        10,
        { tipo: TipoAcaoManual.Prorrogar, motivo: MOTIVO, horas: 3 },
        USUARIOS[2],
      );
    });

    it('answers the alert in the MOD-002 format', async () => {
      const response = await post(2, 'encerrar', { motivo: MOTIVO }).expect(
        200,
      );

      expect(response.body).toMatchObject({ id: 10, status: 'ATIVO' });
    });

    it.each([
      ['encerrar', {}],
      ['encerrar', { motivo: 'curto' }],
      ['encerrar', { motivo: '   nove 9   ' }],
      ['invalidar', { motivo: 123456789012 }],
      ['prorrogar', { motivo: MOTIVO }],
      ['prorrogar', { motivo: MOTIVO, horas: 0 }],
      ['prorrogar', { motivo: MOTIVO, horas: 25 }],
      ['prorrogar', { motivo: MOTIVO, horas: 1.5 }],
      ['encerrar', { motivo: MOTIVO, horas: 2 }],
    ])('answers 422 to %s with %j (RN-015 #6, #8)', async (acao, body) => {
      await post(2, acao, body).expect(422);
      expect(service.agir).not.toHaveBeenCalled();
    });

    it('answers 422 to an invalid id', async () => {
      await request(app.getHttpServer())
        .post('/alertas/abc/encerrar')
        .set('Authorization', `Bearer ${tokens[2]}`)
        .send({ motivo: MOTIVO })
        .expect(422);
    });
  });
});
