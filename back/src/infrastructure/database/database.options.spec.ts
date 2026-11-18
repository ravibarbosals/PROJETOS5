import {
  APP_SCHEMA,
  buildDatabaseOptions,
  MIGRATIONS_GLOB,
} from '@/infrastructure/database/database.options';

const env = {
  DATABASE_URL: 'postgresql://postgres:secret@localhost:5432/vigia',
};

describe('buildDatabaseOptions', () => {
  it('maps the environment to the PostgreSQL connection', () => {
    const options = buildDatabaseOptions(env);

    expect(options).toMatchObject({
      type: 'postgres',
      url: 'postgresql://postgres:secret@localhost:5432/vigia',
    });
  });

  it('keeps entities and the migrations table in the app schema', () => {
    const options = buildDatabaseOptions(env);

    expect(APP_SCHEMA).toBe('app');
    expect(options.schema).toBe('app');
    expect(options.migrationsTableName).toBe('migrations');
  });

  it('never lets TypeORM change the schema on its own', () => {
    const options = buildDatabaseOptions(env);

    expect(options.synchronize).toBe(false);
    expect(options.migrationsRun).toBe(false);
    expect(options.migrations).toEqual([MIGRATIONS_GLOB]);
  });
});
