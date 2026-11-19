import { HttpStatus } from '@nestjs/common';
import { defineBusinessRules } from '@/core/exceptions/business-rule.exception';

// Catálogo de regras de negócio do MOD-001 (regras-negocio.md).
export const AcessoRules = defineBusinessRules({
  // RN-010 #2: único mesmo entre usuários inativos.
  EMAIL_JA_CADASTRADO: {
    message: 'Já existe um usuário com este e-mail',
    status: HttpStatus.CONFLICT,
  },
});
