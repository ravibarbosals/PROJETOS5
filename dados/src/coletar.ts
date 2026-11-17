import { coletarOpenMeteo } from './coletores/openmeteo.js';
import { criarPool } from './db.js';

const pool = criarPool();

try {
  const coleta = await coletarOpenMeteo();
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO bronze.coleta (fonte, url, status_http, payload)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [
      coleta.fonte,
      coleta.url,
      coleta.statusHttp,
      JSON.stringify(coleta.payload),
    ],
  );
  console.log(
    `coleta ${rows[0].id}: ${coleta.fonte}, HTTP ${coleta.statusHttp}`,
  );
  if (coleta.statusHttp !== 200) {
    process.exitCode = 1;
  }
} finally {
  await pool.end();
}