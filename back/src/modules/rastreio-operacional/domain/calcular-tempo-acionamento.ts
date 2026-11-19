// RN-006: tempo de acionamento = primeira ação ligada - hora do disparo do
// alerta.

export interface AlertaComAcoes {
  dthrDisparo: Date;
  acoes: { dthrCriacao: Date }[];
}

export interface TempoAcionamento {
  /** Média em milissegundos sobre os alertas com pelo menos uma ação; null se nenhum tiver. */
  mediaMs: number | null;
  alertasComAcao: number;
  /** RN-006 #3 (DUV-032): contados à parte, fora da média (PR-021). */
  alertasSemAcao: number;
}

// RN-006 #1. Nulo quando o alerta não tem ação ligada.
export function tempoAcionamentoMs(alerta: AlertaComAcoes): number | null {
  if (alerta.acoes.length === 0) return null;
  const primeira = Math.min(
    ...alerta.acoes.map((a) => a.dthrCriacao.getTime()),
  );
  return primeira - alerta.dthrDisparo.getTime();
}

// RN-006 #2: média sobre os alertas do período.
export function calcularTempoAcionamento(
  alertas: AlertaComAcoes[],
): TempoAcionamento {
  const tempos = alertas
    .map(tempoAcionamentoMs)
    .filter((tempo): tempo is number => tempo !== null);

  return {
    mediaMs:
      tempos.length === 0
        ? null
        : tempos.reduce((soma, tempo) => soma + tempo, 0) / tempos.length,
    alertasComAcao: tempos.length,
    alertasSemAcao: alertas.length - tempos.length,
  };
}
