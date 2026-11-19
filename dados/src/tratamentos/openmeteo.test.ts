import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { extrairLeituras } from './openmeteo.js';

const payload = {
  hourly: {
    time: ['2026-11-17T09:00', '2026-11-17T10:00', '2026-11-17T11:00'],
    precipitation: [0, 2.4, 5],
    temperature_2m: [28.1, null, 30],
    relative_humidity_2m: [80, 75, 70],
    surface_pressure: [1012.3, 1012.1, 1011.8],
  },
};
const coletadoEm = new Date('2026-11-17T10:30:00Z');

describe('extrairLeituras', () => {
  it('turns each hour and variable into one reading in UTC', () => {
    const leituras = extrairLeituras(payload, coletadoEm);

    const chuva = leituras.find(
      (l) =>
        l.variavel === 'precipitacao_mm' &&
        l.lidaEm.toISOString() === '2026-11-17T10:00:00.000Z',
    );
    assert.equal(chuva?.valor, 2.4);
    assert.equal(chuva?.fonte, 'openmeteo');
  });

  it('drops hours after the collection (forecast)', () => {
    const leituras = extrairLeituras(payload, coletadoEm);

    assert.ok(leituras.every((l) => l.lidaEm <= coletadoEm));
  });

  it('drops null values', () => {
    const leituras = extrairLeituras(payload, coletadoEm);

    // 2 horas passadas x 4 variáveis, menos a temperatura nula
    assert.equal(leituras.length, 7);
  });

  it('rejects a payload without hourly data', () => {
    assert.throws(
      () => extrairLeituras({ erro: 'x' }, coletadoEm),
      /sem hourly/,
    );
  });
});