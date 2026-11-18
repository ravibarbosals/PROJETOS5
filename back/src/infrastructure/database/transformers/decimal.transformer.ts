import { ValueTransformer } from 'typeorm';

// The pg driver returns numeric as string (to keep precision); the API works
// with numbers.
export const decimalTransformer: ValueTransformer = {
  to: (value: unknown) => value,
  from: (value: unknown) => (typeof value === 'string' ? Number(value) : value),
};
