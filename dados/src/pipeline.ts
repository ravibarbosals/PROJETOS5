import type pg from 'pg';
import { coletarOpenMeteo } from './coletores/openmeteo.js';
import { extrairLeituras } from './tratamentos/openmeteo.js';

const UPSERT = `
  INSERT INTO gold.leitura_climatica
    (fonte, estacao, territorio, variavel, valor, lida_em)
  VALUES ($1, $2, $3, $4, $5, $6)
  ON CONFLICT (fonte, estacao, variavel, lida_em)
  DO UPDATE SET valor = EXCLUDED.valor, atualizado_em = now()`;

// Chama a API e grava a resposta bruta. Devolve false se a fonte falhou.
export async function coletar(pool: pg.Pool): Promise<boolean> {
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
  return coleta.statusHttp === 200;
}

// Move as coletas pendentes do bronze para o gold. Devolve false se alguma
// falhou.
export async function tratar(pool: pg.Pool): Promise<boolean> {
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

  let ok = true;
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
      ok = false;
    } finally {
      cliente.release();
    }
  }
  console.log(`${coletas.length} coletas pendentes lidas`);
  return ok;
}