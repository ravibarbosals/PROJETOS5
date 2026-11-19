import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PeriodoPainel } from '@/modules/paineis/enums/periodo-painel.enum';
import { VariavelClimatica } from '@/modules/paineis/enums/variavel-climatica.enum';

// MOD-005: filtros do GET /leituras.
export class LeiturasQueryDto {
  /** Janela até agora: 24h, 7d ou 30d (padrão 24h, PR-018) */
  @IsOptional()
  @IsEnum(PeriodoPainel, { message: 'Período inválido' })
  periodo: PeriodoPainel = PeriodoPainel.Ultimas24Horas;

  /** Variável climática */
  @IsOptional()
  @IsEnum(VariavelClimatica, { message: 'Variável inválida' })
  variavel?: VariavelClimatica;

  /** Território (hoje só Recife, DUV-009) */
  @IsOptional()
  @IsString({ message: 'Território inválido' })
  @MaxLength(50, { message: 'Território inválido' })
  territorio?: string;
}
