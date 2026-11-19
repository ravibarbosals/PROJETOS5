import { normalizarBairro } from '@/modules/paineis/indicador-territorio/domain/normalizar-bairro';

describe('normalizarBairro (MOD-005)', () => {
  it('drops accents, extra spaces and case', () => {
    expect(normalizarBairro('  Água   Fria ')).toBe('AGUA FRIA');
    expect(normalizarBairro('jardim são paulo')).toBe('JARDIM SAO PAULO');
  });

  it('keeps a name that is already in the gold format', () => {
    expect(normalizarBairro('IBURA')).toBe('IBURA');
  });
});
