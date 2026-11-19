import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { buildDatabaseOptions } from '../src/infrastructure/database/database.options';
import { aplicarAmbienteE2e } from './e2e-ambiente';

// Relative imports only: globalSetup does not go through moduleNameMapper.
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

// Requires the PostgreSQL of compose.yml (docker compose up -d --wait).
// Recreates the e2e database (always "<db>_e2e", see e2e-ambiente.ts), the app
// schema (what db-init does for the development database) and the pipeline
// schemas, then applies every migration from scratch with the same CLI as
// production (DEC-008), so the e2e also prove them and no run inherits the
// data of the previous one.
export default async function globalSetup() {
  const banco = aplicarAmbienteE2e();

  await executar('postgres', `DROP DATABASE IF EXISTS ${banco} WITH (FORCE)`);
  await executar('postgres', `CREATE DATABASE ${banco}`);
  await executar(banco, 'CREATE SCHEMA IF NOT EXISTS app');
  // Gold of the pipeline (read by MOD-005), from the same SQL used on Neon.
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
