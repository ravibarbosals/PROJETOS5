import { http } from '@/lib/http'
import type { Territorio } from '@/modules/territorios/types'

export async function listarTerritorios(): Promise<Territorio[]> {
  const { data } = await http.get<Territorio[]>('/territorios')
  return data
}