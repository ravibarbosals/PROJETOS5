import { useQuery } from '@tanstack/react-query'
import { consultarMapa } from '@/modules/mapa/service/mapa.service'

export const mapaKeys = {
  todos: ['mapa'] as const,
}

// Chuva e alertas mudam a cada ciclo da pipeline e do job: recarrega a cada 5
// minutos, como as leituras.
export function useMapaQuery() {
  return useQuery({
    queryKey: mapaKeys.todos,
    queryFn: consultarMapa,
    refetchInterval: 5 * 60_000,
  })
}
