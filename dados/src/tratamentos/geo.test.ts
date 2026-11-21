import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { simplificar, utm25sParaGraus, type Ponto } from './geo.js';

describe('utm25sParaGraus', () => {
  it('converts a point in Recife from UTM 25S to longitude/latitude', () => {
    const [lon, lat] = utm25sParaGraus([290000, 9110000]);

    assert.ok(Math.abs(lon - -34.90552) < 1e-5);
    assert.ok(Math.abs(lat - -8.04716) < 1e-5);
  });
});

describe('simplificar', () => {
  it('drops vertices that barely leave the line, keeping the ends', () => {
    const linha: Ponto[] = [
      [0, 0],
      [10, 1],
      [20, 0],
      [30, 50],
      [40, 0],
    ];

    assert.deepEqual(simplificar(linha, 5), [
      [0, 0],
      [20, 0],
      [30, 50],
      [40, 0],
    ]);
  });

  it('keeps a closed ring closed', () => {
    const anel: Ponto[] = [
      [0, 0],
      [100, 0],
      [100, 100],
      [0, 100],
      [0, 0],
    ];

    const simples = simplificar(anel, 10);

    assert.deepEqual(simples[0], simples[simples.length - 1]);
    assert.equal(simples.length, 5);
  });
});
