import { http } from '@/lib/http'
import type { Intervalo } from '@/lib/periodo'
import type {
  FiltrosIndicadores,
  IndicadorTerritorio,
  TempoAcionamento,
} from '@/modules/indicadores/types'

export async function consultarTempoAcionamento(intervalo: Intervalo): Promise<TempoAcionamento> {
  const { data } = await http.get<TempoAcionamento>('/indicadores/tempo-acionamento', {
    params: intervalo,
  })
  return data
}

export async function listarIndicadores(
  filtros: FiltrosIndicadores,
): Promise<IndicadorTerritorio[]> {
  const { data } = await http.get<IndicadorTerritorio[]>('/indicadores', { params: filtros })
  return data
}