import { exigirBancoLocal } from '@/infrastructure/database/seed-demo/banco-local';

describe('exigirBancoLocal (TASK-050)', () => {
  it.each([
    'postgresql://postgres:x@localhost:5432/vigia',
    'postgresql://postgres:x@127.0.0.1:5466/vigia',
    'postgresql://postgres:x@[::1]:5432/vigia',
    'postgresql://postgres:x@db:5432/vigia',
  ])('accepts a local database: %s', (url) => {
    expect(() => exigirBancoLocal(url)).not.toThrow();
  });

  it.each([
    'postgresql://u:x@ep-abc-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require',
    'postgresql://u:x@meu-servidor.exemplo.gov.br:5432/vigia',
  ])('refuses a remote database: %s', (url) => {
    expect(() => exigirBancoLocal(url)).toThrow('só roda no Postgres local');
  });

  it.each([undefined, '', 'não é url'])('refuses an invalid URL: %s', (url) => {
    expect(() => exigirBancoLocal(url)).toThrow('DATABASE_URL inválida');
  });
});
