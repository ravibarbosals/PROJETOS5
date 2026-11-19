import { MotivoEncerramento } from '@/modules/alertas/enums/motivo-encerramento.enum';
import { NivelAlerta } from '@/modules/alertas/enums/nivel-alerta.enum';

// Função pura do job de alertas (TASK-035) para uma variável + território:
// decide disparo, atualização, escalonamento e encerramento automático
// (RN-012, RN-013, RN-015, DEC-029). O job busca os dados e grava a decisão.

const HORA_MS = 60 * 60 * 1000;

export interface ParametroAvaliado {
  id: number;
  limiar: number;
  limiarSaida: number;
  nivel: NivelAlerta;
}

// Valor do parâmetro na leitura mais recente: para a chuva, o acumulado da
// janela do parâmetro; para as outras variáveis, a própria leitura (RN-012).
export interface Avaliacao {
  parametro: ParametroAvaliado;
  valor: number;
  lidaEm: Date;
}

export interface AlertaAtivo {
  parametro: ParametroAvaliado;
  nivel: NivelAlerta;
  valorMaximo: number;
  prorrogadoAte: Date | null;
}

export interface PontoDaSerie {
  lidaEm: Date;
  valor: number;
}

export interface EntradaAvaliacao {
  // Só parâmetros ativos (RN-012 #3), avaliados na leitura mais recente.
  avaliacoes: Avaliacao[];
  alerta: AlertaAtivo | null;
  // Valores recentes do parâmetro do alerta, em ordem de lidaEm (RN-015 #1).
  serieDoAlerta: PontoDaSerie[];
  // Leitura mais recente da fonte para a variável + território; null se nenhuma.
  ultimaLeituraEm: Date | null;
  // Último encerramento de alerta da variável + território; null se nenhum.
  ultimoEncerramentoEm: Date | null;
  agora: Date;
  estabilizacaoHoras: number;
  expiracaoHoras: number;
}

export type Decisao =
  | { tipo: 'NENHUMA' }
  | { tipo: 'DISPARAR'; avaliacao: Avaliacao }
  | { tipo: 'ATUALIZAR'; valorMaximo: number; ultimaLeituraEm: Date }
  | {
      tipo: 'ESCALONAR';
      parametro: ParametroAvaliado;
      valorMaximo: number;
      ultimaLeituraEm: Date;
    }
  | { tipo: 'ENCERRAR'; motivo: MotivoEncerramento };

const PESO: Record<NivelAlerta, number> = {
  [NivelAlerta.Moderado]: 1,
  [NivelAlerta.Alto]: 2,
};

// RN-012 #1: entre os parâmetros cruzados (valor >= limiar), vale o de maior
// nível; no empate de nível, o de maior limiar.
export function maiorParametroCruzado(
  avaliacoes: Avaliacao[],
): Avaliacao | null {
  return avaliacoes
    .filter((a) => a.valor >= a.parametro.limiar)
    .reduce<Avaliacao | null>((maior, a) => {
      if (!maior) return a;
      const diferenca = PESO[a.parametro.nivel] - PESO[maior.parametro.nivel];
      if (diferenca !== 0) return diferenca > 0 ? a : maior;
      return a.parametro.limiar > maior.parametro.limiar ? a : maior;
    }, null);
}

// RN-015 #1: as leituras mais recentes estão todas abaixo do limiar de saída
// e esse trecho já dura o tempo de estabilização.
export function normalizado(
  serie: PontoDaSerie[],
  limiarSaida: number,
  estabilizacaoHoras: number,
): boolean {
  const ultima = serie.at(-1);
  if (!ultima || ultima.valor >= limiarSaida) return false;
  let inicio = ultima;
  for (let i = serie.length - 1; i >= 0 && serie[i].valor < limiarSaida; i--) {
    inicio = serie[i];
  }
  return (
    ultima.lidaEm.getTime() - inicio.lidaEm.getTime() >=
    estabilizacaoHoras * HORA_MS
  );
}

export function avaliarLeitura(entrada: EntradaAvaliacao): Decisao {
  const { alerta, agora } = entrada;
  const cruzado = maiorParametroCruzado(entrada.avaliacoes);

  // RN-015 #3: fonte parada; leituras antigas não mantêm nem disparam alerta.
  const semLeitura =
    entrada.ultimaLeituraEm === null ||
    agora.getTime() - entrada.ultimaLeituraEm.getTime() >=
      entrada.expiracaoHoras * HORA_MS;

  if (!alerta) {
    // RN-015 #10: depois de um encerramento, só uma leitura nova dispara.
    const novo =
      cruzado !== null &&
      !semLeitura &&
      (entrada.ultimoEncerramentoEm === null ||
        cruzado.lidaEm > entrada.ultimoEncerramentoEm);
    return novo
      ? { tipo: 'DISPARAR', avaliacao: cruzado }
      : { tipo: 'NENHUMA' };
  }

  // RN-015 #6 e #7: prorrogado só impede o encerramento automático.
  const prorrogado =
    alerta.prorrogadoAte !== null && alerta.prorrogadoAte > agora;

  if (semLeitura) {
    return prorrogado
      ? { tipo: 'NENHUMA' }
      : { tipo: 'ENCERRAR', motivo: MotivoEncerramento.Expirado };
  }

  if (cruzado) {
    // RN-012 #5: sobe de nível; RN-012 #6: nunca desce.
    if (PESO[cruzado.parametro.nivel] > PESO[alerta.nivel]) {
      return {
        tipo: 'ESCALONAR',
        parametro: cruzado.parametro,
        valorMaximo: Math.max(alerta.valorMaximo, cruzado.valor),
        ultimaLeituraEm: cruzado.lidaEm,
      };
    }
    // RN-012 #4: o máximo é medido no parâmetro do próprio alerta.
    const doAlerta =
      entrada.avaliacoes.find((a) => a.parametro.id === alerta.parametro.id) ??
      cruzado;
    return {
      tipo: 'ATUALIZAR',
      valorMaximo: Math.max(alerta.valorMaximo, doAlerta.valor),
      ultimaLeituraEm: doAlerta.lidaEm,
    };
  }

  if (
    !prorrogado &&
    normalizado(
      entrada.serieDoAlerta,
      alerta.parametro.limiarSaida,
      entrada.estabilizacaoHoras,
    )
  ) {
    return { tipo: 'ENCERRAR', motivo: MotivoEncerramento.Normalizado };
  }
  return { tipo: 'NENHUMA' };
}
