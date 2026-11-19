import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { montarIndicadores } from './arboviroses.js';

const dengue2024 = {
  agravo: 'dengue',
  contagens: [
    { bairro: 'IBURA', semana: '202401', casos: 3 },
    { bairro: 'IBURA', semana: '202501', casos: 1 },
  ],
};
const dengue2025 = {
  agravo: 'dengue',
  contagens: [{ bairro: 'IBURA', semana: '202501', casos: 5 }],
};

describe('montarIndicadores', () => {
  it('turns each count into one row by epidemiological week', () => {
    const [linha] = montarIndicadores([dengue2024]);

    assert.deepEqual(linha, {
      fonte: 'recife_arboviroses',
      territorio: 'Recife',
      bairro: 'IBURA',
      indicador: 'dengue',
      periodo: '2024-SE01',
      valor: 3,
    });
  });

  it('adds up the same week coming from two yearly files', () => {
    const linhas = montarIndicadores([dengue2024, dengue2025]);

    const semana = linhas.find((l) => l.periodo === '2025-SE01');
    assert.equal(semana?.valor, 6);
    assert.equal(linhas.length, 2);
  });

  it('keeps diseases apart', () => {
    const linhas = montarIndicadores([
      dengue2025,
      { ...dengue2025, agravo: 'zika' },
    ]);

    assert.deepEqual(linhas.map((l) => l.indicador).sort(), ['dengue', 'zika']);
  });

  it('rejects a payload without counts or with an unknown disease', () => {
    assert.throws(() => montarIndicadores([{ erro: 'x' }]), /sem agravo/);
    assert.throws(
      () => montarIndicadores([{ agravo: 'febre amarela', contagens: [] }]),
      /sem agravo/,
    );
  });

  it('rejects a malformed week', () => {
    assert.throws(
      () =>
        montarIndicadores([
          {
            agravo: 'dengue',
            contagens: [{ bairro: 'X', semana: '2025', casos: 1 }],
          },
        ]),
      /inválida/,
    );
  });
});