import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { intervaloDoPeriodo, type Periodo } from '@/lib/periodo'
import {
  consultarDecisoesPendentes,
  consultarTempoAcionamento,
  listarIndicadores,
} from '@/modules/indicadores/service/indicadores.service'
import type { Agravo } from '@/modules/indicadores/types'

// Prefixo 'indicadores': registrar uma ação invalida estes dados (useCriarAcao).
export const indicadoresKeys = {
  tempoAcionamento: (periodo: Periodo) => ['indicadores', 'tempo-acionamento', periodo] as const,
  decisoesPendentes: ['indicadores', 'decisoes-pendentes'] as const,
  arboviroses: (agravo: Agravo, ano: number | null) =>
    ['indicadores', 'arboviroses', agravo, ano] as const,
}

export function useTempoAcionamentoQuery(periodo: Periodo) {
  return useQuery({
    queryKey: indicadoresKeys.tempoAcionamento(periodo),
    queryFn: () => consultarTempoAcionamento(intervaloDoPeriodo(periodo)),
    placeholderData: keepPreviousData,
  })
}

// PR-033: um alerta novo do job sai daqui quando alguém registra a primeira
// ação (o prefixo 'indicadores' é invalidado); recarrega a cada 5 minutos, como
// o mapa.
export function useDecisoesPendentesQuery() {
  return useQuery({
    queryKey: indicadoresKeys.decisoesPendentes,
    queryFn: consultarDecisoesPendentes,
    refetchInterval: 5 * 60_000,
  })
}

// Sem ano, a API devolve o último ano publicado (DEC-031). O portal publica
// com meses de atraso: não há por que recarregar sozinho.
export function useArbovirosesQuery(agravo: Agravo, ano: number | null, enabled = true) {
  return useQuery({
    queryKey: indicadoresKeys.arboviroses(agravo, ano),
    queryFn: () => listarIndicadores({ indicador: agravo, ...(ano === null ? {} : { ano }) }),
    placeholderData: keepPreviousData,
    enabled,
  })
}
