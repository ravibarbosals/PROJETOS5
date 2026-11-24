import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { extrairLeiturasCemaden, type LimiteDaRpa } from './cemaden.js';

// Dois quadrados lado a lado no lugar das RPAs
const limites: LimiteDaRpa[] = [
  {
    territorio: 'RPA 1 - Centro',
    coordenadas: [[[[-35, -8.1], [-34.9, -8.1], [-34.9, -8], [-35, -8], [-35, -8.1]]]],
  },
  {
    territorio: 'RPA 2 - Norte',
    coordenadas: [[[[-34.9, -8.1], [-34.8, -8.1], [-34.8, -8], [-34.9, -8], [-34.9, -8.1]]]],
  },
];

const leitura = (extra: Record<string, unknown>) => ({
  cidade: 'RECIFE',
  codestacao: '261160620A',
  datahora: '2026-11-24 15:40:00',
  id_sensor: 10,
  latitude: -8.05,
  longitude: -34.95,
  nome: 'Porto',
  offset: null,
  qualificacao: '0000',
  uf: 'PE',
  valor: 1.2,
  ...extra,
});

describe('extrairLeiturasCemaden', () => {
  it('turns each rain gauge reading into a precipitation reading in UTC', () => {
    const [l] = extrairLeiturasCemaden([leitura({})], limites);

    assert.deepEqual(l, {
      fonte: 'cemaden',
      estacao: '261160620A',
      territorio: 'RPA 1 - Centro',
      variavel: 'precipitacao_mm',
      valor: 1.2,
      lidaEm: new Date('2026-11-24T15:40:00Z'),
    });
  });

  it('puts each station in the RPA whose boundary contains it', () => {
    const leituras = extrairLeiturasCemaden(
      [leitura({ codestacao: 'A', longitude: -34.95 }), leitura({ codestacao: 'B', longitude: -34.85 })],
      limites,
    );

    assert.deepEqual(
      leituras.map((l) => [l.estacao, l.territorio]),
      [['A', 'RPA 1 - Centro'], ['B', 'RPA 2 - Norte']],
    );
  });

  it('leaves a station outside every RPA in Recife', () => {
    const [l] = extrairLeiturasCemaden([leitura({ longitude: -34.5 })], limites);

    assert.equal(l.territorio, 'Recife');
  });

  it('drops other sensors and malformed rows', () => {
    const leituras = extrairLeiturasCemaden(
      [leitura({ id_sensor: 240 }), leitura({ valor: null }), leitura({ datahora: 'x' }), 'x', leitura({})],
      limites,
    );

    assert.equal(leituras.length, 1);
  });

  it('rejects an error payload', () => {
    assert.throws(() => extrairLeiturasCemaden({ erro: 'x' }, limites), /não é uma lista/);
  });

  it('waits for the RPA boundaries before assigning stations', () => {
    assert.throws(() => extrairLeiturasCemaden([leitura({})], []), /limites das RPAs/);
  });
});
