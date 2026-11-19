import type pg from 'pg';
import {
  coletarRecurso,
  FONTE as FONTE_ARBOVIROSES,
  listarRecursos,
  VERSAO_CONTAGEM,
} from './coletores/arboviroses.js';
import { coletarOpenMeteo, type Coleta } from './coletores/openmeteo.js';
import { montarIndicadores } from './tratamentos/arboviroses.js';
import { extrairLeituras } from './tratamentos/openmeteo.js';

const UPSERT = `
  INSERT INTO gold.leitura_climatica
    (fonte, estacao, territorio, variavel, valor, lida_em)
  VALUES ($1, $2, $3, $4, $5, $6)
  ON CONFLICT (fonte, estacao, variavel, lida_em)
  DO UPDATE SET valor = EXCLUDED.valor, atualizado_em = now()`;

async function gravarColeta(pool: pg.Pool, coleta: Coleta): Promise<boolean> {
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

// DEC-031: só baixa um recurso quando o portal o republica (a data de
// modificação muda) ou quando a forma de contar muda (VERSAO_CONTAGEM). Na
// maioria dos ciclos, só a lista é consultada.
async function coletarArboviroses(pool: pg.Pool): Promise<boolean> {
  let recursos;
  try {
    recursos = await listarRecursos();
  } catch (erro) {
    console.error(`${FONTE_ARBOVIROSES}: ${String(erro)}`);
    return false;
  }

  let ok = true;
  for (const recurso of recursos) {
    const { rowCount } = await pool.query(
      `SELECT 1 FROM bronze.coleta
       WHERE fonte = $1 AND status_http = 200
         AND payload->>'recurso' = $2 AND payload->>'modificado_em' = $3
         AND payload->>'versao' = $4`,
      [
        FONTE_ARBOVIROSES,
        recurso.id,
        recurso.modificadoEm,
        String(VERSAO_CONTAGEM),
      ],
    );
    if (rowCount) continue;
    ok = (await gravarColeta(pool, await coletarRecurso(recurso))) && ok;
  }
  return ok;
}

// Chama as APIs e grava as respostas no bronze. Devolve false se alguma fonte
// falhou.
export async function coletar(pool: pg.Pool): Promise<boolean> {
  const openMeteo = await gravarColeta(pool, await coletarOpenMeteo());
  const arboviroses = await coletarArboviroses(pool);
  return openMeteo && arboviroses;
}

async function tratarOpenMeteo(pool: pg.Pool): Promise<boolean> {
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
  console.log(`${coletas.length} coletas pendentes do openmeteo lidas`);
  return ok;
}

// Com alguma coleta nova, refaz o gold da fonte a partir da última coleta de
// cada recurso: um recurso republicado pode ter perdido casos (fichas
// descartadas depois), e o upsert sozinho deixaria a contagem antiga.
async function tratarArboviroses(pool: pg.Pool): Promise<boolean> {
  const { rows: pendentes } = await pool.query<{ id: string }>(
    `SELECT id FROM bronze.coleta
     WHERE fonte = $1 AND status_http = 200 AND processado_em IS NULL`,
    [FONTE_ARBOVIROSES],
  );
  if (pendentes.length === 0) return true;

  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const { rows: ultimas } = await cliente.query<{ payload: unknown }>(
      `SELECT DISTINCT ON (payload->>'recurso') payload
       FROM bronze.coleta
       WHERE fonte = $1 AND status_http = 200
       ORDER BY payload->>'recurso', coletado_em DESC`,
      [FONTE_ARBOVIROSES],
    );
    const indicadores = montarIndicadores(ultimas.map((u) => u.payload));

    await cliente.query(
      'DELETE FROM gold.indicador_territorio WHERE fonte = $1',
      [FONTE_ARBOVIROSES],
    );
    // Um INSERT só, com uma lista por coluna: milhares de linhas sem milhares
    // de idas ao banco
    await cliente.query(
      `INSERT INTO gold.indicador_territorio
         (fonte, territorio, bairro, indicador, periodo, valor)
       SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[],
                            $5::text[], $6::int[])`,
      [
        indicadores.map((i) => i.fonte),
        indicadores.map((i) => i.territorio),
        indicadores.map((i) => i.bairro),
        indicadores.map((i) => i.indicador),
        indicadores.map((i) => i.periodo),
        indicadores.map((i) => i.valor),
      ],
    );
    await cliente.query(
      'UPDATE bronze.coleta SET processado_em = now() WHERE id = ANY($1)',
      [pendentes.map((p) => p.id)],
    );
    await cliente.query('COMMIT');
    console.log(
      `${FONTE_ARBOVIROSES}: ${pendentes.length} coletas novas, ${indicadores.length} linhas no gold`,
    );
    return true;
  } catch (erro) {
    await cliente.query('ROLLBACK');
    console.error(`${FONTE_ARBOVIROSES}: ${String(erro)}`);
    return false;
  } finally {
    cliente.release();
  }
}

// Move as coletas pendentes do bronze para o gold. Devolve false se alguma
// falhou.
export async function tratar(pool: pg.Pool): Promise<boolean> {
  const openMeteo = await tratarOpenMeteo(pool);
  const arboviroses = await tratarArboviroses(pool);
  return openMeteo && arboviroses;
}