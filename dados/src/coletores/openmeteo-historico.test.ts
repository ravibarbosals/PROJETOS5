import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  hojeNoRecife,
  janelaDoHistorico,
  somarDias,
  urlDoHistorico,
} from './openmeteo-historico.js';

// 2026-11-21 10:00 no Recife (UTC-3)
const AGORA = new Date('2026-11-21T13:00:00Z');
const horasAntes = (h: number) => new Date(AGORA.getTime() - h * 3_600_000);

describe('somarDias e hojeNoRecife', () => {
  it('crosses months and years', () => {
    assert.equal(somarDias('2026-03-01', -1), '2026-02-28');
    assert.equal(somarDias('2025-12-31', 1), '2026-01-01');
  });

  it('uses the Recife day, not the UTC one', () => {
    // 01:00 UTC ainda é o dia anterior no Recife
    assert.equal(hojeNoRecife(new Date('2026-11-22T01:00:00Z')), '2026-11-21');
  });
});

describe('janelaDoHistorico', () => {
  const base = {
    primeiroAno: 2023,
    carregadoDesde: null,
    ultimaColetaEm: null,
    agora: AGORA,
  };

  it('does nothing without arboviroses in the gold', () => {
    assert.equal(janelaDoHistorico({ ...base, primeiroAno: null }), null);
  });

  it('loads everything up to yesterday the first time, from November of the year before', () => {
    assert.deepEqual(janelaDoHistorico(base), {
      inicio: '2022-11-01',
      fim: '2026-11-20',
    });
  });

  it('then refreshes only the last 30 days, once a day', () => {
    const carregado = { ...base, carregadoDesde: '2022-11-01' };

    assert.equal(
      janelaDoHistorico({ ...carregado, ultimaColetaEm: horasAntes(3) }),
      null,
    );
    assert.deepEqual(
      janelaDoHistorico({ ...carregado, ultimaColetaEm: horasAntes(21) }),
      { inicio: '2026-10-22', fim: '2026-11-20' },
    );
  });

  it('loads everything again when the first year moves back (TASK-074)', () => {
    assert.deepEqual(
      janelaDoHistorico({
        ...base,
        primeiroAno: 2015,
        carregadoDesde: '2022-11-01',
        ultimaColetaEm: horasAntes(1),
      }),
      { inicio: '2014-11-01', fim: '2026-11-20' },
    );
  });
});

describe('urlDoHistorico', () => {
  it('asks the archive API for the 6 RPA points, daily, in Recife time', () => {
    const url = new URL(
      urlDoHistorico({ inicio: '2022-11-01', fim: '2026-11-20' }),
    );

    assert.equal(url.host, 'archive-api.open-meteo.com');
    assert.equal(url.searchParams.get('latitude')?.split(',').length, 6);
    assert.equal(url.searchParams.get('start_date'), '2022-11-01');
    assert.equal(url.searchParams.get('end_date'), '2026-11-20');
    assert.equal(url.searchParams.get('timezone'), 'America/Recife');
    assert.match(url.searchParams.get('daily') ?? '', /precipitation_sum/);
  });
});
