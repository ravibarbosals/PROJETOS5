import { http } from '@/lib/http'
import type { Mapa } from '@/modules/mapa/types'

export async function consultarMapa(): Promise<Mapa> {
  const { data } = await http.get<Mapa>('/mapa')
  return data
}
