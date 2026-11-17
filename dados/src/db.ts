import pg from 'pg';

export function criarPool(): pg.Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL não definida no .env');
  }
  return new pg.Pool({ connectionString });
}