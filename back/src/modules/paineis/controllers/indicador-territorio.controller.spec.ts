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
import { IndicadorTerritorioController } from '@/modules/paineis/controllers/indicador-territorio.controller';
import { IndicadorEpidemiologico } from '@/modules/paineis/enums/indicador-epidemiologico.enum';
import { IndicadorTerritorioService } from '@/modules/paineis/services/indicador-territorio.service';

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

// PER-010 e os filtros do contrato do MOD-005 (TASK-039), com o guard, o pipe
// e o filtro reais.
describe('IndicadorTerritorioController', () => {
  let app: INestApplication<App>;
  const tokens: Record<number, string> = {};
  const indicadores = { listar: jest.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'x'.repeat(32) })],
      controllers: [IndicadorTerritorioController],
      providers: [
        { provide: IndicadorTerritorioService, useValue: indicadores },
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
    indicadores.listar.mockReset().mockResolvedValue([]);
  });

  const get = (url: string, id = 1) =>
    request(app.getHttpServer())
      .get(url)
      .set('Authorization', `Bearer ${tokens[id]}`);

  it('answers 401 without login', async () => {
    await request(app.getHttpServer()).get('/indicadores').expect(401);
  });

  it.each(PAPEIS.map((papel, i) => [papel, i + 1]))(
    '%s reads it (PER-010)',
    async (_papel, id) => {
      await get('/indicadores', id).expect(200);
    },
  );

  it('lets the browser reuse the answer for 5 minutes, privately', async () => {
    const response = await get('/indicadores').expect(200);

    expect(response.headers['cache-control']).toBe('private, max-age=300');
  });

  it('passes the year as a number and the neighborhood normalized', async () => {
    await get(
      `/indicadores?ano=2024&indicador=dengue&bairro=${encodeURIComponent(' Água fria ')}`,
    ).expect(200);

    expect(indicadores.listar).toHaveBeenCalledWith({
      ano: 2024,
      indicador: IndicadorEpidemiologico.Dengue,
      bairro: 'AGUA FRIA',
    });
  });

  it('sends no filter when none is given', async () => {
    await get('/indicadores').expect(200);

    expect(indicadores.listar).toHaveBeenCalledWith({});
  });

  it.each([
    ['ano=1999', 'Ano inválido'],
    ['ano=2025.5', 'Ano inválido'],
    ['ano=dois-mil', 'Ano inválido'],
    ['indicador=febre-amarela', 'Indicador inválido'],
    ['bairro=%20%20', 'Bairro inválido'],
    [`bairro=${'x'.repeat(81)}`, 'Bairro inválido'],
    ['territorio=Recife', 'Dados inválidos'],
  ])('answers 422 for %s', async (filtro, mensagem) => {
    const response = await get(`/indicadores?${filtro}`).expect(422);

    expect(JSON.stringify(response.body)).toContain(mensagem);
    expect(indicadores.listar).not.toHaveBeenCalled();
  });
});
