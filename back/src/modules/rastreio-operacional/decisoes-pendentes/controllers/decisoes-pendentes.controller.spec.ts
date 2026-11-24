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
import { DecisoesPendentesController } from '@/modules/rastreio-operacional/decisoes-pendentes/controllers/decisoes-pendentes.controller';
import { DecisoesPendentesService } from '@/modules/rastreio-operacional/decisoes-pendentes/services/decisoes-pendentes.service';

const PAPEIS = [
  Papel.Tecnico,
  Papel.Gestor,
  Papel.GestaoInstitucional,
  Papel.Comunicacao,
  Papel.Administrador,
];

// Um usuário por papel: id = posição + 1.
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

const URL = '/indicadores/decisoes-pendentes';

// PER-016, com o guard, o pipe e o filtro reais.
describe('DecisoesPendentesController', () => {
  let app: INestApplication<App>;
  const tokens: Record<number, string> = {};
  const service = { listar: jest.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'x'.repeat(32) })],
      controllers: [DecisoesPendentesController],
      providers: [
        { provide: DecisoesPendentesService, useValue: service },
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
    service.listar.mockReset();
    service.listar.mockResolvedValue({ total: 0, alertas: [] });
  });

  const get = (id: number) =>
    request(app.getHttpServer())
      .get(URL)
      .set('Authorization', `Bearer ${tokens[id]}`);

  it('answers 401 without login', async () => {
    await request(app.getHttpServer()).get(URL).expect(401);
  });

  it.each([
    [Papel.Tecnico, 1],
    [Papel.Gestor, 2],
    [Papel.Comunicacao, 4],
  ])('answers 403 for %s', async (_papel, id) => {
    await get(id).expect(403);
    expect(service.listar).not.toHaveBeenCalled();
  });

  it.each([
    [Papel.GestaoInstitucional, 3],
    [Papel.Administrador, 5],
  ])('answers 200 for %s', async (_papel, id) => {
    const res = await get(id).expect(200);

    expect(res.body).toEqual({ total: 0, alertas: [] });
  });
});
