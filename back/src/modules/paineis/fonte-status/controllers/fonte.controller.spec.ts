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
import { FonteController } from '@/modules/paineis/fonte-status/controllers/fonte.controller';
import { FonteStatusService } from '@/modules/paineis/fonte-status/services/fonte-status.service';

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

// PER-010, com o guard, o pipe e o filtro reais.
describe('FonteController', () => {
  let app: INestApplication<App>;
  const tokens: Record<number, string> = {};
  const fontes = { listar: jest.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'x'.repeat(32) })],
      controllers: [FonteController],
      providers: [
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
    fontes.listar.mockReset().mockResolvedValue([]);
  });

  it('answers 401 without login', async () => {
    await request(app.getHttpServer()).get('/fontes/status').expect(401);
  });

  it.each(PAPEIS.map((papel, i) => [papel, i + 1]))(
    '%s reads it (PER-010)',
    async (_papel, id) => {
      await request(app.getHttpServer())
        .get('/fontes/status')
        .set('Authorization', `Bearer ${tokens[id]}`)
        .expect(200);
    },
  );
});
