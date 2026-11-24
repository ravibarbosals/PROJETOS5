import {
  ATRIBUICAO_CEMADEN,
  atribuicoesDasFontes,
  nomeDaFonte,
} from '@/modules/paineis/fonte-status/domain/nome-da-fonte';

describe('nomeDaFonte', () => {
  it('names the known sources for the reader', () => {
    expect(nomeDaFonte('openmeteo')).toBe('Open-Meteo (modelo meteorológico)');
    expect(nomeDaFonte('cemaden')).toBe('Cemaden (pluviômetros)');
  });

  it('keeps the technical name of an unknown source', () => {
    expect(nomeDaFonte('outra')).toBe('outra');
  });
});

describe('atribuicoesDasFontes', () => {
  it('cites the Cemaden network whenever its data is shown (DEC-036)', () => {
    expect(atribuicoesDasFontes(['cemaden', 'openmeteo'])).toEqual([
      ATRIBUICAO_CEMADEN,
    ]);
    expect(atribuicoesDasFontes(['openmeteo'])).toEqual([]);
  });
});
