import { VariavelClimatica } from '@/modules/paineis/enums/variavel-climatica.enum';

// MOD-005 contract (DEC-011).
export class LeituraResponseDto {
  fonte!: string;
  estacao!: string;
  territorio!: string;
  variavel!: VariavelClimatica;
  valor!: number;
  lida_em!: Date;
  /** Última atualização da fonte (RN-007); nula se a fonte não tem registro */
  fonte_atualizada_em!: Date | null;
}
