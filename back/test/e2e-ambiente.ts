import 'dotenv/config';

const SUFIXO = '_e2e';

// The e2e never touch the development database: same server (compose.yml),
// own database. Real environment variables win over .env (dotenv does not
// override them), and the database name gets the suffix only once.
export function aplicarAmbienteE2e(): string {
  const url = new URL(
    process.env.DATABASE_URL ??
      'postgresql://postgres:postgres@localhost:5432/vigia',
  );
  const base = url.pathname.slice(1) || 'vigia';
  const banco = base.endsWith(SUFIXO) ? base : `${base}${SUFIXO}`;
  // Goes into CREATE DATABASE, which takes no parameters.
  if (!/^\w+$/.test(banco)) {
    throw new Error(`Nome de banco inválido para os e2e: ${banco}`);
  }
  url.pathname = `/${banco}`;
  process.env.DATABASE_URL = url.toString();
  process.env.NODE_ENV = 'test';
  return banco;
}
