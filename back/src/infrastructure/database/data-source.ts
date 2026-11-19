// Ponto de entrada da CLI do TypeORM (npm run migration:*). A aplicação usa o
// DatabaseModule; os dois compartilham o buildDatabaseOptions.
import 'dotenv/config';
import 'reflect-metadata';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { validateEnv } from '@/core/config/env.validation';
import { buildDatabaseOptions } from '@/infrastructure/database/database.options';

const env = validateEnv(process.env);

export default new DataSource({
  ...buildDatabaseOptions(env),
  entities: [join(__dirname, '..', '..', '**', '*.entity.{ts,js}')],
});
