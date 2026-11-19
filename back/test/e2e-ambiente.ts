import 'dotenv/config';

const SUFIXO = '_e2e';

// Os e2e nunca tocam o banco de desenvolvimento: mesmo servidor (compose.yml),
// banco próprio. Variáveis de ambiente reais vencem o .env (o dotenv não as
// sobrescreve), e o nome do banco ganha o sufixo uma vez só.
export function aplicarAmbienteE2e(): string {
  const url = new URL(
    process.env.DATABASE_URL ??
      'postgresql://postgres:postgres@localhost:5432/vigia',
  );
  const base = url.pathname.slice(1) || 'vigia';
  const banco = base.endsWith(SUFIXO) ? base : `${base}${SUFIXO}`;
  // Vai para o CREATE DATABASE, que não aceita parâmetros.
  if (!/^\w+$/.test(banco)) {
    throw new Error(`Nome de banco inválido para os e2e: ${banco}`);
  }
  url.pathname = `/${banco}`;
  process.env.DATABASE_URL = url.toString();
  process.env.NODE_ENV = 'test';
  return banco;
}
