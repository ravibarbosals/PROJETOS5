import { HttpStatus } from '@nestjs/common';
import { defineBusinessRules } from '@/core/exceptions/business-rule.exception';

// Business rule catalog of MOD-002 (regras-negocio.md).
export const AlertasRules = defineBusinessRules({
  // DEC-029: the exit threshold (hysteresis) sits below the trigger threshold.
  LIMIAR_SAIDA_INVALIDO: {
    message: 'O limiar de saída deve ser menor que o limiar',
    status: HttpStatus.UNPROCESSABLE_ENTITY,
  },
});
