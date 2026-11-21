import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PONTOS } from '../coletores/openmeteo.js';
import { extrairDias } from './openmeteo-historico.js';

function ponto(daily: Record<string, unknown[]>) {
  return { daily: { time: ['2023-01-01', '2023-01-02'], ...daily } };
}

const completo = ponto({
  precipitation_sum: [10.2, 0],
  temperature_2m_mean: [24.8, 25.8],
  temperature_2m_min: [22.6, 21.9],
  temperature_2m_max: [27.8, 28.8],
  relative_humidity_2m_mean: [86, 79],
});

const payload = (resposta: unknown[]) => ({
  inicio: '2023-01-01',
  fim: '2023-01-02',
  resposta,
});

describe('extrairDias', () => {
  it('makes one row per RPA and day, in the PONTOS order', () => {
    const dias = extrairDias(payload(PONTOS.map(() => completo)));

    assert.equal(dias.length, 12);
    assert.deepEqual(dias[0], {
      fonte: 'openmeteo_historico',
      estacao: 'rpa1',
      territorio: 'RPA 1 - Centro',
      dia: '2023-01-01',
      chuvaMm: 10.2,
      tempMediaC: 24.8,
      tempMinC: 22.6,
      tempMaxC: 27.8,
      umidadeMediaPct: 86,
    });
    assert.equal(dias[11].estacao, 'rpa6');
    // Zero de chuva é dado, não falta
    assert.equal(dias[1].chuvaMm, 0);
  });

  it('keeps a partial day with nulls and drops a day with nothing', () => {
    const lacunas = ponto({
      precipitation_sum: [null, null],
      temperature_2m_mean: [24.8, null],
      temperature_2m_min: [null, null],
      temperature_2m_max: [null, null],
      relative_humidity_2m_mean: [null, null],
    });
    const dias = extrairDias(payload(PONTOS.map(() => lacunas)));

    assert.equal(dias.length, 6);
    assert.equal(dias[0].dia, '2023-01-01');
    assert.equal(dias[0].chuvaMm, null);
    assert.equal(dias[0].tempMediaC, 24.8);
  });

  it('rejects a payload that does not match the 6 points', () => {
    assert.throws(() => extrairDias(payload([completo])), /6/);
    assert.throws(() => extrairDias({ erro: 'x' }), /sem resposta/);
    assert.throws(
      () => extrairDias(payload(PONTOS.map(() => ({ daily: { time: [] } })))),
      /precipitation_sum/,
    );
  });
});
