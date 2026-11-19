import { HttpStatus } from '@nestjs/common';
import { defineBusinessRules } from '@/core/exceptions/business-rule.exception';

// Catálogo de regras de negócio do MOD-002 (regras-negocio.md).
export const AlertasRules = defineBusinessRules({
  // DEC-029: o limiar de saída (histerese) fica abaixo do limiar de disparo.
  LIMIAR_SAIDA_INVALIDO: {
    message: 'O limiar de saída deve ser menor que o limiar',
    status: HttpStatus.UNPROCESSABLE_ENTITY,
  },
});
