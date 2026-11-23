import { NivelAlerta } from '@/modules/alertas/enums/nivel-alerta.enum';
import {
  type AlertaDoEmail,
  EventoAlerta,
  montarEmailDoAlerta,
} from '@/modules/alertas/notificacao/domain/email-do-alerta';

const alerta: AlertaDoEmail = {
  nivel: NivelAlerta.Moderado,
  variavel: 'precipitacao_mm',
  territorio: 'RPA 6 - Sul',
  limiar: 30,
  valorLido: 36.25,
  valorMaximo: 36.25,
  // 09:00 no Recife (UTC-3)
  lidaEm: new Date('2026-11-21T12:00:00Z'),
  fonte: 'openmeteo',
  estacao: 'rpa6',
  dthrDisparo: new Date('2026-11-21T12:10:00Z'),
  dthrEscalonamento: null,
};

// DEC-037, PR-027.
describe('montarEmailDoAlerta', () => {
  it('describes a new alert with the reading, threshold and source in Recife time', () => {
    const { assunto, texto } = montarEmailDoAlerta(
      alerta,
      EventoAlerta.Disparo,
    );

    expect(assunto).toBe(
      '[O Vigia] Alerta MODERADO: Precipitação em RPA 6 - Sul',
    );
    expect(texto).toContain(
      'Alerta MODERADO disparado em 21/11/2026, 09:10 (horário do Recife).',
    );
    expect(texto).toContain('Limiar do nível MODERADO: 30 mm');
    expect(texto).toContain(
      'Valor que disparou: 36,3 mm, lido em 21/11/2026, 09:00',
    );
    expect(texto).toContain('Fonte: openmeteo (estação rpa6)');
    expect(texto).not.toContain('Valor máximo');
  });

  it('describes an escalation with the new level and the peak value', () => {
    const { assunto, texto } = montarEmailDoAlerta(
      {
        ...alerta,
        nivel: NivelAlerta.Alto,
        variavel: 'temperatura_c',
        limiar: 35,
        valorMaximo: 37,
        dthrEscalonamento: new Date('2026-11-21T15:00:00Z'),
      },
      EventoAlerta.Escalonamento,
    );

    expect(assunto).toBe(
      '[O Vigia] Alerta escalonado para ALTO: Temperatura em RPA 6 - Sul',
    );
    expect(texto).toContain(
      'subiu para ALTO em 21/11/2026, 12:00 (horário do Recife)',
    );
    expect(texto).toContain('Limiar do nível ALTO: 35 °C');
    expect(texto).toContain('Valor máximo até agora: 37 °C');
  });

  it('keeps an unknown variable by its gold name', () => {
    const { assunto } = montarEmailDoAlerta(
      { ...alerta, variavel: 'vento_kmh' },
      EventoAlerta.Disparo,
    );

    expect(assunto).toContain('vento_kmh em RPA 6 - Sul');
  });
});
