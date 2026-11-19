import { ValueTransformer } from 'typeorm';

// O driver pg devolve numeric como string (para não perder precisão); a API
// trabalha com número.
export const decimalTransformer: ValueTransformer = {
  to: (value: unknown) => value,
  from: (value: unknown) => (typeof value === 'string' ? Number(value) : value),
};
