// Códigos de erro do PostgreSQL (SQLSTATE) que a aplicação traduz em respostas
// HTTP (DEC-010).
export enum PostgresError {
  UniqueViolation = '23505',
  ForeignKeyViolation = '23503',
}

function errorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const { code, driverError } = error as {
    code?: unknown;
    driverError?: { code?: unknown };
  };
  const value = driverError?.code ?? code;
  return typeof value === 'string' ? value : undefined;
}

export function isUniqueViolation(error: unknown): boolean {
  return errorCode(error) === PostgresError.UniqueViolation;
}
