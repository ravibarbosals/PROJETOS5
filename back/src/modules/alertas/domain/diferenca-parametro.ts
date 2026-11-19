import type { ParametroAlerta } from '@/modules/alertas/entities/parametro-alerta.entity';
import { NivelAlerta } from '@/modules/alertas/enums/nivel-alerta.enum';
import { OperacaoHistorico } from '@/modules/alertas/enums/operacao-historico.enum';

// Campos editáveis com os nomes da API, que também são as chaves do histórico
// (RN-001).
export interface CamposEditaveis {
  limiar: number;
  limiar_saida: number;
  janela_horas: number;
  nivel: NivelAlerta;
  ativo: boolean;
}

export interface DiferencaParametro {
  operacao: OperacaoHistorico;
  anterior: Partial<CamposEditaveis>;
  novo: Partial<CamposEditaveis>;
}

const CAMPOS: (keyof CamposEditaveis)[] = [
  'limiar',
  'limiar_saida',
  'janela_horas',
  'nivel',
  'ativo',
];

export function camposDe(parametro: ParametroAlerta): CamposEditaveis {
  return {
    limiar: parametro.limiar,
    limiar_saida: parametro.limiarSaida,
    janela_horas: parametro.janelaHoras,
    nivel: parametro.nivel,
    ativo: parametro.ativo,
  };
}

export function aplicarCampos(
  parametro: ParametroAlerta,
  campos: Partial<CamposEditaveis>,
): void {
  if (campos.limiar !== undefined) parametro.limiar = campos.limiar;
  if (campos.limiar_saida !== undefined) {
    parametro.limiarSaida = campos.limiar_saida;
  }
  if (campos.janela_horas !== undefined) {
    parametro.janelaHoras = campos.janela_horas;
  }
  if (campos.nivel !== undefined) parametro.nivel = campos.nivel;
  if (campos.ativo !== undefined) parametro.ativo = campos.ativo;
}

// DEC-029: o alerta encerra abaixo do limiar de saída, então ele precisa ser
// menor.
export function limiaresValidos(campos: {
  limiar: number;
  limiar_saida: number;
}): boolean {
  return campos.limiar_saida < campos.limiar;
}

// RN-001 #2: só os campos que de fato mudam vão para o histórico. Nulo quando
// nada muda, para um PATCH sem efeito não deixar linha no histórico.
export function diferencaParametro(
  atual: CamposEditaveis,
  dados: Partial<CamposEditaveis>,
): DiferencaParametro | null {
  const alterados = CAMPOS.filter(
    (campo) => dados[campo] !== undefined && dados[campo] !== atual[campo],
  );
  if (alterados.length === 0) return null;

  const anterior: Partial<CamposEditaveis> = {};
  const novo: Partial<CamposEditaveis> = {};
  for (const campo of alterados) {
    Object.assign(anterior, { [campo]: atual[campo] });
    Object.assign(novo, { [campo]: dados[campo] });
  }

  // RN-001 #3: a inativação é uma operação própria, mesmo junto com outros
  // campos.
  const operacao =
    novo.ativo === false
      ? OperacaoHistorico.Inativacao
      : OperacaoHistorico.Alteracao;
  return { operacao, anterior, novo };
}
