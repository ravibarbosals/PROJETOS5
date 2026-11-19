import { inicioDaJanela } from '@/modules/paineis/leitura/domain/janela-periodo';
import { PeriodoPainel } from '@/modules/paineis/leitura/enums/periodo-painel.enum';

const AGORA = new Date('2026-11-18T12:00:00.000Z');

describe('inicioDaJanela (PR-018)', () => {
  it.each([
    [PeriodoPainel.Ultimas24Horas, '2026-11-17T12:00:00.000Z'],
    [PeriodoPainel.Ultimos7Dias, '2026-11-11T12:00:00.000Z'],
    [PeriodoPainel.Ultimos30Dias, '2026-10-19T12:00:00.000Z'],
  ])('%s starts at %s', (periodo, esperado) => {
    expect(inicioDaJanela(periodo, AGORA).toISOString()).toBe(esperado);
  });
});
