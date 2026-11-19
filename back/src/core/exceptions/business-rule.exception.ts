import { HttpException, HttpStatus } from '@nestjs/common';

export interface BusinessRule {
  code: string;
  message: string;
  status?: HttpStatus;
}

// Violação de uma regra de negócio documentada (DEC-010): 412 por padrão, ou o
// status que a regra define (ex.: 409 para unicidade). O código vai para o
// cliente como business_rule_code.
export class BusinessRuleException extends HttpException {
  readonly businessRuleCode: string;

  constructor(rule: BusinessRule) {
    super(rule.message, rule.status ?? HttpStatus.PRECONDITION_FAILED);
    this.businessRuleCode = rule.code;
  }
}

// Cada módulo declara as suas regras com este helper, para os códigos serem
// únicos por catálogo e a chave ser o próprio código (nada de strings soltas
// nos services).
export function defineBusinessRules<K extends string>(
  rules: Record<K, Omit<BusinessRule, 'code'>>,
): Record<K, BusinessRule> {
  return Object.fromEntries(
    Object.entries<Omit<BusinessRule, 'code'>>(rules).map(([code, rule]) => [
      code,
      { ...rule, code },
    ]),
  ) as Record<K, BusinessRule>;
}
