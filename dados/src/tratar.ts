import { criarPool } from './db.js';
import { extrairLeituras } from './tratamentos/openmeteo.js';

const UPSERT = `
  INSERT INTO gold.leitura_climatica
    (fonte, estacao, territorio, variavel, valor, lida_em)
  VALUES ($1, $2, $3, $4, $5, $6)
  ON CONFLICT (fonte, estacao, variavel, lida_em)
  DO UPDATE SET valor = EXCLUDED.valor, atualizado_em = now()`;

const pool = criarPool();

try {
  const { rows: coletas } = await pool.query<{
    id: string;
    payload: unknown;
    coletado_em: Date;
  }>(
    `SELECT id, payload, coletado_em
     FROM bronze.coleta
     WHERE fonte = 'openmeteo' AND status_http = 200 AND processado_em IS NULL
     ORDER BY coletado_em`,
  );

  for (const coleta of coletas) {
    const cliente = await pool.connect();
    try {
      await cliente.query('BEGIN');
      const leituras = extrairLeituras(coleta.payload, coleta.coletado_em);
      for (const l of leituras) {
        await cliente.query(UPSERT, [
          l.fonte,
          l.estacao,
          l.territorio,
          l.variavel,
          l.valor,
          l.lidaEm,
        ]);
      }
      await cliente.query(
        'UPDATE bronze.coleta SET processado_em = now() WHERE id = $1',
        [coleta.id],
      );
      await cliente.query('COMMIT');
      console.log(`coleta ${coleta.id}: ${leituras.length} leituras`);
    } catch (erro) {
      await cliente.query('ROLLBACK');
      console.error(`coleta ${coleta.id}: ${String(erro)}`);
      process.exitCode = 1;
    } finally {
      cliente.release();
    }
  }
  console.log(`${coletas.length} coletas pendentes lidas`);
} finally {
  await pool.end();
}