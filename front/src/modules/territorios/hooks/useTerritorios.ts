import { useQuery } from '@tanstack/react-query'
import { listarTerritorios } from '@/modules/territorios/service/territorios.service'
import { TERRITORIO_PADRAO } from '@/modules/territorios/types'

export const territoriosKeys = {
  todos: ['territorios'] as const,
}

// O catálogo só muda com a pipeline (DEC-035): uma consulta por sessão basta.
export function useTerritoriosQuery() {
  return useQuery({
    queryKey: territoriosKeys.todos,
    queryFn: listarTerritorios,
    staleTime: Infinity,
  })
}

// Nomes para as listas de escolha. Enquanto carrega, ou se a consulta falhar,
// fica só o Recife, que sempre existe.
export function useNomesDeTerritorio(): string[] {
  const { data } = useTerritoriosQuery()
  return data?.length ? data.map((t) => t.nome) : [TERRITORIO_PADRAO]
}
