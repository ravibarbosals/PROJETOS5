import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { buildDatabaseOptions } from '../src/infrastructure/database/database.options';
import { aplicarAmbienteE2e } from './e2e-ambiente';

// Só imports relativos: o globalSetup não passa pelo moduleNameMapper.
function conexao(database: string): DataSource {
  const url = new URL(process.env.DATABASE_URL ?? '');
  url.pathname = `/${database}`;
  return new DataSource({
    ...buildDatabaseOptions({ DATABASE_URL: url.toString() }),
    migrations: [],
  });
}

async function executar(database: string, sql: string): Promise<unknown[]> {
  const fonte = await conexao(database).initialize();
  try {
    return await fonte.query<unknown[]>(sql);
  } finally {
    await fonte.destroy();
  }
}

// Precisa do PostgreSQL do compose.yml (docker compose up -d --wait). Recria o
// banco de e2e (sempre "<banco>_e2e", ver e2e-ambiente.ts), o schema app (o que
// o db-init faz no banco de desenvolvimento) e os schemas da pipeline, depois
// aplica todas as migrações do zero com a mesma CLI da produção (DEC-008).
// Assim os e2e também provam as migrações e nenhuma execução herda os dados da
// anterior.
export default async function globalSetup() {
  const banco = aplicarAmbienteE2e();

  await executar('postgres', `DROP DATABASE IF EXISTS ${banco} WITH (FORCE)`);
  await executar('postgres', `CREATE DATABASE ${banco}`);
  await executar(banco, 'CREATE SCHEMA IF NOT EXISTS app');
  // Gold da pipeline (lido pelo MOD-005), com o mesmo SQL usado no Neon.
  await executar(
    banco,
    readFileSync(
      join(__dirname, '..', '..', 'dados', 'sql', 'schema.sql'),
      'utf8',
    ),
  );

  try {
    execSync('npm run migration:run', { env: process.env, stdio: 'pipe' });
  } catch (error) {
    const { stdout, stderr } = error as { stdout?: Buffer; stderr?: Buffer };
    console.error(stdout?.toString(), stderr?.toString());
    throw error;
  }
}
