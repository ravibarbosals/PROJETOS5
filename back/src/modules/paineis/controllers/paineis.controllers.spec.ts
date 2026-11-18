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
import { UsuarioService } from '@/modules/acesso/services/usuario.service';
import { FonteController } from '@/modules/paineis/controllers/fonte.controller';
import { LeituraController } from '@/modules/paineis/controllers/leitura.controller';
import { PeriodoPainel } from '@/modules/paineis/enums/periodo-painel.enum';
import { VariavelClimatica } from '@/modules/paineis/enums/variavel-climatica.enum';
import { FonteStatusService } from '@/modules/paineis/services/fonte-status.service';
import { LeituraService } from '@/modules/paineis/services/leitura.service';

const PAPEIS = [
  Papel.Tecnico,
  Papel.Gestor,
  Papel.GestaoInstitucional,
  Papel.Comunicacao,
  Papel.Administrador,
];

// One user per role: id = position + 1.
const USUARIOS: Record<number, Usuario> = Object.fromEntries(
  PAPEIS.map((papel, i) => [
    i + 1,
    Object.assign(new Usuario(), {
      id: i + 1,
      nome: `Usuário ${papel}`,
      ativo: true,
      papeis: [Object.assign(new UsuarioPapel(), { papel })],
    }),
  ]),
);

// PER-010 and the MOD-005 filters, with the real guard, pipe and filter.
describe('LeituraController and FonteController', () => {
  let app: INestApplication<App>;
  const tokens: Record<number, string> = {};
  const leituras = { listar: jest.fn() };
  const fontes = { listar: jest.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'x'.repeat(32) })],
      controllers: [LeituraController, FonteController],
      providers: [
        { provide: LeituraService, useValue: leituras },
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
    for (const id of Object.keys(USUARIOS).map(Number)) {
      tokens[id] = await jwt.signAsync({ sub: id });
    }
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    leituras.listar.mockReset().mockResolvedValue([]);
    fontes.listar.mockReset().mockResolvedValue([]);
  });

  const get = (url: string, id = 1) =>
    request(app.getHttpServer())
      .get(url)
      .set('Authorization', `Bearer ${tokens[id]}`);

  it.each(['/leituras', '/fontes/status'])(
    '%s answers 401 without login',
    async (url) => {
      await request(app.getHttpServer()).get(url).expect(401);
    },
  );

  it.each(PAPEIS.map((papel, i) => [papel, i + 1]))(
    '%s reads both endpoints (PER-010)',
    async (_papel, id) => {
      await get('/leituras', id).expect(200);
      await get('/fontes/status', id).expect(200);
    },
  );

  it('defaults the period to 24h', async () => {
    await get('/leituras').expect(200);

    expect(leituras.listar).toHaveBeenCalledWith({
      periodo: PeriodoPainel.Ultimas24Horas,
    });
  });

  it('passes the filters to the service', async () => {
    await get(
      '/leituras?periodo=7d&variavel=precipitacao_mm&territorio=Recife',
    ).expect(200);

    expect(leituras.listar).toHaveBeenCalledWith({
      periodo: PeriodoPainel.Ultimos7Dias,
      variavel: VariavelClimatica.Precipitacao,
      territorio: 'Recife',
    });
  });

  it.each([
    ['periodo=1h', 'Período inválido'],
    ['variavel=vento', 'Variável inválida'],
    [`territorio=${'x'.repeat(51)}`, 'Território inválido'],
  ])('answers 422 for %s', async (filtro, mensagem) => {
    const response = await get(`/leituras?${filtro}`).expect(422);

    expect(JSON.stringify(response.body)).toContain(mensagem);
    expect(leituras.listar).not.toHaveBeenCalled();
  });
});
