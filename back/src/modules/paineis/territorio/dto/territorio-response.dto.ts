import { TipoTerritorio } from '@/modules/paineis/territorio/enums/tipo-territorio.enum';

// Contrato do MOD-005 (DEC-035).
export class TerritorioResponseDto {
  /** Nome gravado na coluna territorio de leituras, parâmetros e alertas */
  nome!: string;
  tipo!: TipoTerritorio;
  /** Território que contém este (o Recife para as RPAs); nulo no município */
  pai!: string | null;
}
