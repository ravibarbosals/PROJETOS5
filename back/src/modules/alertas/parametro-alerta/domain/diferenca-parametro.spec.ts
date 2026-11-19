import {
  aplicarCampos,
  camposDe,
  diferencaParametro,
  limiaresValidos,
} from '@/modules/alertas/parametro-alerta/domain/diferenca-parametro';
import { ParametroAlerta } from '@/modules/alertas/entities/parametro-alerta.entity';
import { NivelAlerta } from '@/modules/alertas/enums/nivel-alerta.enum';
import { OperacaoHistorico } from '@/modules/alertas/enums/operacao-historico.enum';

const ATUAL = {
  limiar: 50,
  limiar_saida: 20,
  janela_horas: 24,
  nivel: NivelAlerta.Alto,
  ativo: true,
};

describe('diferencaParametro (RN-001)', () => {
  it('keeps only the changed fields, before and after (#2)', () => {
    expect(
      diferencaParametro(ATUAL, { limiar: 60, nivel: NivelAlerta.Alto }),
    ).toEqual({
      operacao: OperacaoHistorico.Alteracao,
      anterior: { limiar: 50 },
      novo: { limiar: 60 },
    });
  });

  it('tracks the exit threshold and the window (DEC-029)', () => {
    expect(
      diferencaParametro(ATUAL, { limiar_saida: 30, janela_horas: 3 }),
    ).toEqual({
      operacao: OperacaoHistorico.Alteracao,
      anterior: { limiar_saida: 20, janela_horas: 24 },
      novo: { limiar_saida: 30, janela_horas: 3 },
    });
  });

  it('records a deactivation as its own operation (#3)', () => {
    expect(
      diferencaParametro(ATUAL, { ativo: false, nivel: NivelAlerta.Moderado }),
    ).toEqual({
      operacao: OperacaoHistorico.Inativacao,
      anterior: { nivel: 'ALTO', ativo: true },
      novo: { nivel: 'MODERADO', ativo: false },
    });
  });

  it('records a reactivation as a change', () => {
    expect(
      diferencaParametro({ ...ATUAL, ativo: false }, { ativo: true }),
    ).toMatchObject({ operacao: OperacaoHistorico.Alteracao });
  });

  it('is null when nothing changes', () => {
    expect(diferencaParametro(ATUAL, {})).toBeNull();
    expect(diferencaParametro(ATUAL, { limiar: 50, ativo: true })).toBeNull();
  });
});

describe('camposDe and aplicarCampos', () => {
  it('map the entity to the API names and back', () => {
    const parametro = Object.assign(new ParametroAlerta(), {
      limiar: 50,
      limiarSaida: 20,
      janelaHoras: 24,
      nivel: NivelAlerta.Alto,
      ativo: true,
    });

    expect(camposDe(parametro)).toEqual(ATUAL);

    aplicarCampos(parametro, { limiar_saida: 30, janela_horas: 3 });
    expect(parametro).toMatchObject({ limiarSaida: 30, janelaHoras: 3 });
  });
});

describe('limiaresValidos (DEC-029)', () => {
  it('requires the exit threshold below the threshold', () => {
    expect(limiaresValidos({ limiar: 50, limiar_saida: 20 })).toBe(true);
    expect(limiaresValidos({ limiar: 50, limiar_saida: 50 })).toBe(false);
    expect(limiaresValidos({ limiar: 50, limiar_saida: 60 })).toBe(false);
  });
});
