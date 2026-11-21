import type { Territorio } from '@/modules/territorios/types'

// Catálogo do gold (DEC-035), como o GET /territorios devolve.
export const TERRITORIOS: Territorio[] = [
  { nome: 'Recife', tipo: 'MUNICIPIO', pai: null },
  { nome: 'RPA 1 - Centro', tipo: 'RPA', pai: 'Recife' },
  { nome: 'RPA 2 - Norte', tipo: 'RPA', pai: 'Recife' },
  { nome: 'RPA 3 - Noroeste', tipo: 'RPA', pai: 'Recife' },
  { nome: 'RPA 4 - Oeste', tipo: 'RPA', pai: 'Recife' },
  { nome: 'RPA 5 - Sudoeste', tipo: 'RPA', pai: 'Recife' },
  { nome: 'RPA 6 - Sul', tipo: 'RPA', pai: 'Recife' },
]
