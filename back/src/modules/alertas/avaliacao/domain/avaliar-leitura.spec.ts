import {
  AlertaAtivo,
  avaliarLeitura,
  EntradaAvaliacao,
  maiorParametroCruzado,
  normalizado,
  ParametroAvaliado,
} from '@/modules/alertas/avaliacao/domain/avaliar-leitura';
import { MotivoEncerramento } from '@/modules/alertas/enums/motivo-encerramento.enum';
import { NivelAlerta } from '@/modules/alertas/enums/nivel-alerta.enum';

const AGORA = new Date('2026-11-19T12:00:00Z');
const horasAtras = (horas: number) =>
  new Date(AGORA.getTime() - horas * 60 * 60 * 1000);

const MODERADO: ParametroAvaliado = {
  id: 1,
  limiar: 30,
  limiarSaida: 10,
  nivel: NivelAlerta.Moderado,
};
const ALTO: ParametroAvaliado = {
  id: 2,
  limiar: 50,
  limiarSaida: 20,
  nivel: NivelAlerta.Alto,
};

// Chuva acumulada igual para os dois parâmetros, lida há meia hora.
const lido = (valor: number) => [
  { parametro: MODERADO, valor, lidaEm: horasAtras(0.5) },
  { parametro: ALTO, valor, lidaEm: horasAtras(0.5) },
];

const alertaAtivo = (overrides: Partial<AlertaAtivo> = {}): AlertaAtivo => ({
  parametro: MODERADO,
  nivel: NivelAlerta.Moderado,
  valorMaximo: 35,
  prorrogadoAte: null,
  ...overrides,
});

const entrada = (
  overrides: Partial<EntradaAvaliacao> = {},
): EntradaAvaliacao => ({
  avaliacoes: [],
  alerta: null,
  serieDoAlerta: [],
  ultimaLeituraEm: horasAtras(0.5),
  ultimoEncerramentoEm: null,
  agora: AGORA,
  estabilizacaoHoras: 2,
  expiracaoHoras: 6,
  ...overrides,
});

describe('avaliarLeitura: disparo (RN-012)', () => {
  it('fires at the threshold itself: >= (#1, DUV-010)', () => {
    expect(avaliarLeitura(entrada({ avaliacoes: lido(30) }))).toEqual({
      tipo: 'DISPARAR',
      avaliacao: lido(30)[0],
    });
  });

  it('fires with the highest level crossed (#1)', () => {
    const decisao = avaliarLeitura(entrada({ avaliacoes: lido(55) }));

    expect(decisao).toMatchObject({
      tipo: 'DISPARAR',
      avaliacao: { parametro: ALTO, valor: 55 },
    });
  });

  it('does nothing below every threshold (#2)', () => {
    expect(avaliarLeitura(entrada({ avaliacoes: lido(29.9) }))).toEqual({
      tipo: 'NENHUMA',
    });
  });

  it('does not fire on a stale reading (RN-015 #3)', () => {
    expect(
      avaliarLeitura(
        entrada({ avaliacoes: lido(40), ultimaLeituraEm: horasAtras(6) }),
      ),
    ).toEqual({ tipo: 'NENHUMA' });
  });

  it('fires again only on a reading after the last closing (RN-015 #10)', () => {
    expect(
      avaliarLeitura(
        entrada({
          avaliacoes: lido(40),
          ultimoEncerramentoEm: horasAtras(0.5),
        }),
      ),
    ).toEqual({ tipo: 'NENHUMA' });
    expect(
      avaliarLeitura(
        entrada({ avaliacoes: lido(40), ultimoEncerramentoEm: horasAtras(1) }),
      ),
    ).toMatchObject({ tipo: 'DISPARAR' });
  });
});

describe('avaliarLeitura: alerta ativo (RN-012, RN-013)', () => {
  it('updates the same alert while still above (#4)', () => {
    const decisao = avaliarLeitura(
      entrada({ avaliacoes: lido(40), alerta: alertaAtivo() }),
    );

    expect(decisao).toEqual({
      tipo: 'ATUALIZAR',
      valorMaximo: 40,
      ultimaLeituraEm: horasAtras(0.5),
    });
  });

  it('keeps the highest value when the new one is lower (#4)', () => {
    const decisao = avaliarLeitura(
      entrada({
        avaliacoes: lido(31),
        alerta: alertaAtivo({ valorMaximo: 45 }),
      }),
    );

    expect(decisao).toMatchObject({ tipo: 'ATUALIZAR', valorMaximo: 45 });
  });

  it('escalates MODERADO to ALTO in the same alert (#5)', () => {
    const decisao = avaliarLeitura(
      entrada({ avaliacoes: lido(60), alerta: alertaAtivo() }),
    );

    expect(decisao).toEqual({
      tipo: 'ESCALONAR',
      parametro: ALTO,
      valorMaximo: 60,
      ultimaLeituraEm: horasAtras(0.5),
    });
  });

  it('never lowers the level: ALTO back in the MODERADO range (#6)', () => {
    const decisao = avaliarLeitura(
      entrada({
        avaliacoes: lido(35),
        alerta: alertaAtivo({
          parametro: ALTO,
          nivel: NivelAlerta.Alto,
          valorMaximo: 60,
        }),
      }),
    );

    expect(decisao).toMatchObject({ tipo: 'ATUALIZAR', valorMaximo: 60 });
  });
});

describe('avaliarLeitura: encerramento automático (RN-015)', () => {
  // Uma leitura por hora abaixo do limiar de saída, da hora informada até agora.
  const abaixoDesde = (horas: number) =>
    Array.from({ length: horas + 1 }, (_, i) => ({
      lidaEm: horasAtras(horas - i),
      valor: 5,
    }));

  it('closes as NORMALIZADO after 2 h below the exit threshold (#1)', () => {
    const decisao = avaliarLeitura(
      entrada({
        avaliacoes: lido(5),
        alerta: alertaAtivo(),
        serieDoAlerta: [
          { lidaEm: horasAtras(3), valor: 40 },
          ...abaixoDesde(2),
        ],
      }),
    );

    expect(decisao).toEqual({
      tipo: 'ENCERRAR',
      motivo: MotivoEncerramento.Normalizado,
    });
  });

  it('stays active below the threshold but above the exit one (#2)', () => {
    const decisao = avaliarLeitura(
      entrada({
        avaliacoes: lido(15),
        alerta: alertaAtivo(),
        serieDoAlerta: [2, 1, 0].map((h) => ({
          lidaEm: horasAtras(h),
          valor: 15,
        })),
      }),
    );

    expect(decisao).toEqual({ tipo: 'NENHUMA' });
  });

  it('stays active when below the exit threshold for less than 2 h (#1)', () => {
    const decisao = avaliarLeitura(
      entrada({
        avaliacoes: lido(5),
        alerta: alertaAtivo(),
        serieDoAlerta: [
          { lidaEm: horasAtras(2), valor: 40 },
          ...abaixoDesde(1),
        ],
      }),
    );

    expect(decisao).toEqual({ tipo: 'NENHUMA' });
  });

  it('closes as EXPIRADO after 6 h without readings (#3)', () => {
    const decisao = avaliarLeitura(
      entrada({ alerta: alertaAtivo(), ultimaLeituraEm: horasAtras(6) }),
    );

    expect(decisao).toEqual({
      tipo: 'ENCERRAR',
      motivo: MotivoEncerramento.Expirado,
    });
    expect(
      avaliarLeitura(entrada({ alerta: alertaAtivo(), ultimaLeituraEm: null })),
    ).toMatchObject({ tipo: 'ENCERRAR' });
  });

  it('does not close an extended alert, but still updates it (#6)', () => {
    const prorrogado = alertaAtivo({ prorrogadoAte: horasAtras(-1) });

    expect(
      avaliarLeitura(
        entrada({ alerta: prorrogado, ultimaLeituraEm: horasAtras(7) }),
      ),
    ).toEqual({ tipo: 'NENHUMA' });
    expect(
      avaliarLeitura(
        entrada({
          avaliacoes: lido(5),
          alerta: prorrogado,
          serieDoAlerta: abaixoDesde(3),
        }),
      ),
    ).toEqual({ tipo: 'NENHUMA' });
    expect(
      avaliarLeitura(entrada({ avaliacoes: lido(40), alerta: prorrogado })),
    ).toMatchObject({ tipo: 'ATUALIZAR' });
  });

  it('closes again once the extension is over (#7)', () => {
    const decisao = avaliarLeitura(
      entrada({
        alerta: alertaAtivo({ prorrogadoAte: horasAtras(1) }),
        ultimaLeituraEm: horasAtras(7),
      }),
    );

    expect(decisao).toMatchObject({
      tipo: 'ENCERRAR',
      motivo: MotivoEncerramento.Expirado,
    });
  });
});

describe('maiorParametroCruzado', () => {
  it('breaks a level tie by the highest threshold', () => {
    const outroModerado = { ...MODERADO, id: 3, limiar: 40 };

    expect(
      maiorParametroCruzado([
        { parametro: MODERADO, valor: 45, lidaEm: AGORA },
        { parametro: outroModerado, valor: 45, lidaEm: AGORA },
      ])?.parametro,
    ).toBe(outroModerado);
  });

  it('is null when nothing crosses', () => {
    expect(maiorParametroCruzado(lido(1))).toBeNull();
  });
});

describe('normalizado', () => {
  it('is false for an empty series or a last reading above the exit threshold', () => {
    expect(normalizado([], 10, 2)).toBe(false);
    expect(
      normalizado(
        [
          { lidaEm: horasAtras(3), valor: 5 },
          { lidaEm: AGORA, valor: 10 },
        ],
        10,
        2,
      ),
    ).toBe(false);
  });
});
