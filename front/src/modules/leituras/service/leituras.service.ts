import { http } from '@/lib/http'
import type { FiltrosLeituras, Leitura } from '@/modules/leituras/types'

export async function listarLeituras(filtros: FiltrosLeituras): Promise<Leitura[]> {
  const { data } = await http.get<Leitura[]>('/leituras', { params: filtros })
  return data
}