import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { Periodo } from '@/lib/periodo'
import { listarLeituras } from '@/modules/leituras/service/leituras.service'

export const leiturasKeys = {
  periodo: (periodo: Periodo) => ['leituras', periodo] as const,
}

// A pipeline grava de hora em hora (DEC-026): recarrega a cada 5 minutos.
export function useLeiturasQuery(periodo: Periodo) {
  return useQuery({
    queryKey: leiturasKeys.periodo(periodo),
    queryFn: () => listarLeituras({ periodo }),
    placeholderData: keepPreviousData,
    refetchInterval: 5 * 60_000,
  })
}