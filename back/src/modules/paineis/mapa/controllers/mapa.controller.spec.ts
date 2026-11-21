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
import { MapaController } from '@/modules/paineis/mapa/controllers/mapa.controller';
import { MapaService } from '@/modules/paineis/mapa/services/mapa.service';

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

// PER-011, com o guard, o pipe e o filtro reais.
describe('MapaController', () => {
  let app: INestApplication<App>;
  const tokens: Record<number, string> = {};
  const mapa = { montar: jest.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'x'.repeat(32) })],
      controllers: [MapaController],
      providers: [
        { provide: MapaService, useValue: mapa },
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
    mapa.montar
      .mockReset()
      .mockResolvedValue({ rpas: [], areas_risco: [], fontes: [] });
  });

  const get = (papel: Papel) =>
    request(app.getHttpServer())
      .get('/mapa')
      .set('Authorization', `Bearer ${tokens[PAPEIS.indexOf(papel) + 1]}`);

  it('answers 401 without login', async () => {
    await request(app.getHttpServer()).get('/mapa').expect(401);
  });

  it.each([
    Papel.Tecnico,
    Papel.Gestor,
    Papel.GestaoInstitucional,
    Papel.Administrador,
  ])('%s reads it (PER-011)', async (papel) => {
    const response = await get(papel).expect(200);

    expect(response.body).toEqual({ rpas: [], areas_risco: [], fontes: [] });
  });

  it('answers 403 to Comunicação (PER-011)', async () => {
    await get(Papel.Comunicacao).expect(403);

    expect(mapa.montar).not.toHaveBeenCalled();
  });
});
