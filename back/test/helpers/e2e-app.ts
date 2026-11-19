import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '@/app.module';

export type AppE2e = INestApplication<App>;

// O AppModule inteiro: pipe, filtro e guard são providers dele, exatamente como
// no main.ts. O Swagger é a única coisa que o main.ts acrescenta, e ele não
// está sob teste.
export async function criarAppE2e(): Promise<AppE2e> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication<AppE2e>();
  await app.init();
  return app;
}

// Ordem das chaves estrangeiras. controle_avaliacao_alerta mantém a linha única
// criada pela migração; só o marcador volta a nulo.
const TABELAS = [
  'acao',
  'alerta_acao_manual',
  'alerta',
  'parametro_alerta_historico',
  'parametro_alerta',
  'registro_acesso',
  'usuario_papel',
  'usuario',
];

export async function limparBanco(app: AppE2e) {
  const fonte = app.get(DataSource);
  for (const tabela of TABELAS) {
    await fonte.query(`DELETE FROM app.${tabela}`);
  }
  // O marcador só avança (DEC-015): sem isto, um job rodado com a hora real
  // num arquivo deixaria o marcador à frente da hora fixa de outro.
  await fonte.query(
    'UPDATE app.controle_avaliacao_alerta SET ultima_lida_em = NULL',
  );
}
