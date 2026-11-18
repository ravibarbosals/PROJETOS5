import { decimalTransformer } from '@/infrastructure/database/transformers/decimal.transformer';

describe('decimalTransformer', () => {
  it('reads decimal strings as numbers', () => {
    expect(decimalTransformer.from('12.345')).toBe(12.345);
  });

  it('keeps numbers as they are', () => {
    expect(decimalTransformer.from(7.5)).toBe(7.5);
    expect(decimalTransformer.to(7.5)).toBe(7.5);
  });
});
