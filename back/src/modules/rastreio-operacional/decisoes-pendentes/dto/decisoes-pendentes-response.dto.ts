export class AlertaPendenteDto {
  id!: number;
  variavel!: string;
  territorio!: string;
  nivel!: string;
  disparado_em!: Date;
}

// PR-033 (EST-03): alertas ativos ainda sem nenhuma ação registrada.
export class DecisoesPendentesResponseDto {
  total!: number;
  /** Do disparo mais antigo para o mais novo */
  alertas!: AlertaPendenteDto[];
}
