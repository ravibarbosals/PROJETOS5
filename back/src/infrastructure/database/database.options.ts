import { join } from 'node:path';
import type { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import type { EnvironmentVariables } from '@/core/config/env.validation';

// Everything the app writes lives in the `app` schema (DEC-016): entities and
// the migrations table default to it. The schema itself is created outside the
// migrations (compose db-init locally; once by hand on Neon).
export const APP_SCHEMA = 'app';

export const MIGRATIONS_GLOB = join(__dirname, 'migrations', '*.{ts,js}');

type DatabaseEnv = Pick<EnvironmentVariables, 'DATABASE_URL'>;

export function buildDatabaseOptions(
  env: DatabaseEnv,
): PostgresConnectionOptions {
  return {
    type: 'postgres',
    // SSL comes from the URL (sslmode=verify-full on Neon).
    url: env.DATABASE_URL,
    schema: APP_SCHEMA,
    // Schemas bronze and gold belong to the data pipeline (DEC-024).
    synchronize: false,
    migrationsRun: false,
    migrations: [MIGRATIONS_GLOB],
    migrationsTableName: 'migrations',
  };
}
