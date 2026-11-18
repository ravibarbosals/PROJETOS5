import { isUniqueViolation } from '@/infrastructure/database/postgres-errors';

describe('isUniqueViolation', () => {
  it('recognizes the unique violation code on the TypeORM error', () => {
    expect(isUniqueViolation({ driverError: { code: '23505' } })).toBe(true);
  });

  it('recognizes the code on the driver error itself', () => {
    expect(isUniqueViolation({ code: '23505' })).toBe(true);
  });

  it('ignores other errors', () => {
    expect(isUniqueViolation({ driverError: { code: '23503' } })).toBe(false);
    expect(isUniqueViolation(new Error('x'))).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
  });
});
