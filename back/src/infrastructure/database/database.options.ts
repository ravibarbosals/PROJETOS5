import { join } from 'node:path';
import type { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import type { EnvironmentVariables } from '@/core/config/env.validation';

// Tudo o que a aplicação grava fica no schema `app` (DEC-016): as entidades e a
// tabela de migrações usam ele por padrão. O schema em si é criado fora das
// migrações (db-init do compose no local; uma vez à mão no Neon).
export const APP_SCHEMA = 'app';

export const MIGRATIONS_GLOB = join(__dirname, 'migrations', '*.{ts,js}');

type DatabaseEnv = Pick<EnvironmentVariables, 'DATABASE_URL'>;

export function buildDatabaseOptions(
  env: DatabaseEnv,
): PostgresConnectionOptions {
  return {
    type: 'postgres',
    // O SSL vem da URL (sslmode=verify-full no Neon).
    url: env.DATABASE_URL,
    schema: APP_SCHEMA,
    // Os schemas bronze e gold são da pipeline de dados (DEC-024).
    synchronize: false,
    migrationsRun: false,
    migrations: [MIGRATIONS_GLOB],
    migrationsTableName: 'migrations',
  };
}
