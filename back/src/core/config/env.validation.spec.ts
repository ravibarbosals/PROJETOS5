import 'reflect-metadata';
import { NodeEnv, validateEnv } from '@/core/config/env.validation';

const requiredEnv = {
  DATABASE_URL: 'postgresql://postgres:secret@localhost:5432/vigia',
  JWT_SECRET: 'x'.repeat(32),
};

describe('validateEnv', () => {
  it('applies defaults when optional variables are missing', () => {
    const env = validateEnv(requiredEnv);

    expect(env.NODE_ENV).toBe(NodeEnv.Development);
    expect(env.PORT).toBe(3000);
  });

  it('converts numbers from strings', () => {
    const env = validateEnv({ ...requiredEnv, PORT: '8080' });

    expect(env.PORT).toBe(8080);
  });

  it('rejects an invalid PORT', () => {
    expect(() => validateEnv({ ...requiredEnv, PORT: 'abc' })).toThrow(/PORT/);
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(() => validateEnv({ ...requiredEnv, NODE_ENV: 'staging' })).toThrow(
      /NODE_ENV/,
    );
  });

  it('defaults the token lifetime to 8h', () => {
    expect(validateEnv(requiredEnv).JWT_EXPIRES_IN).toBe('8h');
  });

  it('rejects a short JWT secret and an invalid lifetime', () => {
    expect(() => validateEnv({ ...requiredEnv, JWT_SECRET: 'curto' })).toThrow(
      /JWT_SECRET/,
    );
    expect(() =>
      validateEnv({ ...requiredEnv, JWT_EXPIRES_IN: 'amanha' }),
    ).toThrow(/JWT_EXPIRES_IN/);
  });

  it('requires a PostgreSQL connection URL', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL/);
    expect(() =>
      validateEnv({ ...requiredEnv, DATABASE_URL: 'mssql://localhost' }),
    ).toThrow(/DATABASE_URL/);
  });
});
