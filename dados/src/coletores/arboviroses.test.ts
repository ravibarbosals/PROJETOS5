import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { contarCasos, escolherRecursos } from './arboviroses.js';

describe('escolherRecursos', () => {
  const recurso = (name: string, extra = {}) => ({
    id: name,
    name,
    datastore_active: true,
    last_modified: '2026-03-04T11:03:17',
    ...extra,
  });

  it('keeps the most recent years of each disease', () => {
    const escolhidos = escolherRecursos(
      [
        recurso('Casos de Dengue 2023'),
        recurso('Casos de Dengue 2025'),
        recurso('Casos de Dengue 2024'),
        recurso('Casos confirmados de Zika 2025'),
      ],
      2,
    );

    assert.deepEqual(
      escolhidos.map((r) => [r.agravo, r.ano]),
      [
        ['dengue', 2025],
        ['dengue', 2024],
        ['zika', 2025],
      ],
    );
    assert.equal(escolhidos[0].modificadoEm, '2026-03-04T11:03:17');
  });

  it('ignores metadata, lookup tables and files outside the datastore', () => {
    const escolhidos = escolherRecursos([
      recurso('Metadados dos Casos confirmados de Chikungunya'),
      recurso('Tabela de Bairros'),
      recurso('Casos de Dengue 2019', { datastore_active: false }),
    ]);

    assert.deepEqual(escolhidos, []);
  });
});

describe('contarCasos', () => {
  it('counts probable cases by neighborhood and week, dropping discarded ones', () => {
    const { contagens, descartadas } = contarCasos(
      [
        {
          ID_BAIRRO: 20,
          NM_BAIRRO: 'IBURA',
          SEM_NOT: '202501',
          CLASSI_FIN: '10',
        },
        {
          ID_BAIRRO: 20,
          NM_BAIRRO: 'IBURA',
          SEM_NOT: 202501,
          CLASSI_FIN: null,
        },
        {
          ID_BAIRRO: 20,
          NM_BAIRRO: 'IBURA',
          SEM_NOT: '202501',
          CLASSI_FIN: '5',
        },
        {
          ID_BAIRRO: 88,
          NM_BAIRRO: 'COHAB',
          SEM_NOT: '202502',
          CLASSI_FIN: '8',
        },
      ],
      'dengue',
    );

    assert.equal(descartadas, 1);
    assert.deepEqual(contagens, [
      { bairro: 'IBURA', semana: '202501', casos: 2 },
      { bairro: 'COHAB', semana: '202502', casos: 1 },
    ]);
  });

  it('uses the discard code of each disease (zika is 2)', () => {
    const { contagens } = contarCasos(
      [
        {
          ID_BAIRRO: 20,
          NM_BAIRRO: 'IBURA',
          SEM_NOT: '202501',
          CLASSI_FIN: '2',
        },
        {
          ID_BAIRRO: 20,
          NM_BAIRRO: 'IBURA',
          SEM_NOT: '202501',
          CLASSI_FIN: '5',
        },
      ],
      'zika',
    );

    assert.deepEqual(contagens, [
      { bairro: 'IBURA', semana: '202501', casos: 1 },
    ]);
  });

  it('keeps a hand-typed name only when it matches a coded one (TASK-063)', () => {
    const { contagens } = contarCasos(
      [
        { ID_BAIRRO: 23, NM_BAIRRO: 'CAMPO GRANDE', SEM_NOT: '202501' },
        { ID_BAIRRO: '', NM_BAIRRO: ' Campo  Grande ', SEM_NOT: '202501' },
        { ID_BAIRRO: null, NM_BAIRRO: 'JIQU]', SEM_NOT: '202501' },
        { ID_BAIRRO: null, NM_BAIRRO: 'VASC', SEM_NOT: '202501' },
      ],
      'dengue',
    );

    assert.deepEqual(contagens, [
      { bairro: 'CAMPO GRANDE', semana: '202501', casos: 2 },
      { bairro: 'NAO INFORMADO', semana: '202501', casos: 2 },
    ]);
  });

  it('reads lowercase column names and groups a blank neighborhood', () => {
    const { contagens, semSemana } = contarCasos(
      [
        { id_bairro: null, nm_bairro: '', sem_not: '202301', classi_fin: '10' },
        { id_bairro: 20, nm_bairro: 'IBURA', sem_not: null, classi_fin: '10' },
      ],
      'dengue',
    );

    assert.deepEqual(contagens, [
      { bairro: 'NAO INFORMADO', semana: '202301', casos: 1 },
    ]);
    assert.equal(semSemana, 1);
  });
});