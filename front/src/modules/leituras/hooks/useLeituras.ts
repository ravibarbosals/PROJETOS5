import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { Periodo } from '@/lib/periodo'
import { listarLeituras } from '@/modules/leituras/service/leituras.service'

export const leiturasKeys = {
  consulta: (periodo: Periodo, territorio: string) => ['leituras', periodo, territorio] as const,
}

// A pipeline grava de hora em hora (DEC-026): recarrega a cada 5 minutos. O
// Recife inclui as leituras das RPAs (DEC-035).
export function useLeiturasQuery(periodo: Periodo, territorio: string) {
  return useQuery({
    queryKey: leiturasKeys.consulta(periodo, territorio),
    queryFn: () => listarLeituras({ periodo, territorio }),
    placeholderData: keepPreviousData,
    refetchInterval: 5 * 60_000,
  })
}
