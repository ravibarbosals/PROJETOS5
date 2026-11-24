import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  dentroDoMultiPoligono,
  simplificar,
  utm25sParaGraus,
  type Ponto,
} from './geo.js';

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

describe('dentroDoMultiPoligono', () => {
  const quadrado: Ponto[] = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]];
  const buraco: Ponto[] = [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]];
  const outro: Ponto[] = [[20, 0], [30, 0], [30, 10], [20, 10], [20, 0]];

  it('finds a point inside any of the polygons', () => {
    assert.equal(dentroDoMultiPoligono([2, 2], [[quadrado], [outro]]), true);
    assert.equal(dentroDoMultiPoligono([25, 5], [[quadrado], [outro]]), true);
  });

  it('leaves out a point outside every polygon', () => {
    assert.equal(dentroDoMultiPoligono([15, 5], [[quadrado], [outro]]), false);
  });

  it('leaves out a point inside a hole', () => {
    assert.equal(dentroDoMultiPoligono([5, 5], [[quadrado, buraco]]), false);
  });
});
