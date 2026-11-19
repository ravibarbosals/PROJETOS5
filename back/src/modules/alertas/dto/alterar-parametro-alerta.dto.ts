import { PartialType, PickType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CriarParametroAlertaDto } from '@/modules/alertas/dto/criar-parametro-alerta.dto';

// RN-001 #2: limiares, janela e nível mudam. Variável e território identificam
// o parâmetro; outro par é outro parâmetro.
export class AlterarParametroAlertaDto extends PartialType(
  PickType(CriarParametroAlertaDto, [
    'limiar',
    'limiar_saida',
    'janela_horas',
    'nivel',
  ] as const),
) {
  /** false inativa o parâmetro (DEC-014, RN-001 #3) */
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
