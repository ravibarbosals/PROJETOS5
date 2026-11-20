// TASK-050: os dados de demonstração só entram no Postgres local (compose ou
// localhost), nunca no Neon. Lista de hosts permitidos, não de proibidos: um
// host desconhecido também é recusado.
const HOSTS_LOCAIS = ['localhost', '127.0.0.1', '[::1]', 'db'];

export function exigirBancoLocal(databaseUrl: string | undefined): void {
  let host: string;
  try {
    host = new URL(databaseUrl ?? '').hostname;
  } catch {
    throw new Error('DATABASE_URL inválida');
  }
  if (!HOSTS_LOCAIS.includes(host)) {
    throw new Error(
      `O seed de demonstração só roda no Postgres local (${HOSTS_LOCAIS.join(', ')}); host recebido: ${host}`,
    );
  }
}
