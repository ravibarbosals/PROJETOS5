import type pg from 'pg';
import {
  coletarRecurso,
  FONTE as FONTE_ARBOVIROSES,
  listarRecursos,
  VERSAO_CONTAGEM,
} from './coletores/arboviroses.js';
import {
  coletarCemaden,
  credenciaisCemaden,
  FONTE_CEMADEN,
} from './coletores/cemaden.js';
import {
  coletarAreasDeRisco,
  coletarLimitesRpa,
  coletarPopulacao,
  FONTE_AREAS_RISCO,
  FONTE_LIMITES_RPA,
  FONTE_POPULACAO,
  listarAreasDeRisco,
  recursoDosLimites,
  VERSAO_POPULACAO,
  type RecursoCkan,
} from './coletores/mapa.js';
import { coletarOpenMeteo, type Coleta } from './coletores/openmeteo.js';
import {
  coletarClimaHistorico,
  FONTE_CLIMA_HISTORICO,
  janelaDoHistorico,
} from './coletores/openmeteo-historico.js';
import { montarIndicadores } from './tratamentos/arboviroses.js';
import {
  extrairLeiturasCemaden,
  type LimiteDaRpa,
} from './tratamentos/cemaden.js';
import {
  montarAreasDeRisco,
  montarLimites,
  montarPopulacao,
} from './tratamentos/mapa.js';
import { extrairLeituras, type Leitura } from './tratamentos/openmeteo.js';
import { extrairDias } from './tratamentos/openmeteo-historico.js';

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

// Já existe coleta bem-sucedida com este valor no campo do payload?
async function jaColetado(
  pool: pg.Pool,
  fonte: string,
  campo: string,
  valor: string,
  recurso?: string,
): Promise<boolean> {
  const { rowCount } = await pool.query(
    `SELECT 1 FROM bronze.coleta
     WHERE fonte = $1 AND status_http = 200 AND payload->>$2 = $3
       AND ($4::text IS NULL OR payload->>'recurso' = $4)`,
    [fonte, campo, valor, recurso ?? null],
  );
  return Boolean(rowCount);
}

// DEC-038: áreas de risco, limites das RPAs e população mudam pouco. Só baixa
// quando o portal republica o arquivo ou quando muda o censo.
async function coletarMapa(pool: pg.Pool): Promise<boolean> {
  let ok = true;
  const coletarSeMudou = async (
    fonte: string,
    recurso: RecursoCkan,
    coletarRecurso: (r: RecursoCkan) => Promise<Coleta>,
  ) => {
    if (
      await jaColetado(pool, fonte, 'modificado_em', recurso.modificadoEm, recurso.id)
    ) {
      return;
    }
    ok = (await gravarColeta(pool, await coletarRecurso(recurso))) && ok;
  };

  try {
    for (const recurso of await listarAreasDeRisco()) {
      await coletarSeMudou(FONTE_AREAS_RISCO, recurso, coletarAreasDeRisco);
    }
  } catch (erro) {
    console.error(`${FONTE_AREAS_RISCO}: ${String(erro)}`);
    ok = false;
  }
  try {
    await coletarSeMudou(
      FONTE_LIMITES_RPA,
      await recursoDosLimites(),
      coletarLimitesRpa,
    );
  } catch (erro) {
    console.error(`${FONTE_LIMITES_RPA}: ${String(erro)}`);
    ok = false;
  }
  if (!(await jaColetado(pool, FONTE_POPULACAO, 'versao', VERSAO_POPULACAO))) {
    ok = (await gravarColeta(pool, await coletarPopulacao())) && ok;
  }
  return ok;
}

// DEC-042: clima diário do histórico do Open-Meteo para o modelo preditivo,
// nos anos que as arboviroses cobrem (janelaDoHistorico decide o trecho).
async function coletarHistorico(pool: pg.Pool): Promise<boolean> {
  const { rows } = await pool.query<{
    primeiro_ano: number | null;
    carregado_desde: string | null;
    ultima_coleta_em: Date | null;
  }>(
    `SELECT
       (SELECT min(left(periodo, 4))::int FROM gold.indicador_territorio)
         AS primeiro_ano,
       (SELECT min(payload->>'inicio') FROM bronze.coleta
        WHERE fonte = $1 AND status_http = 200) AS carregado_desde,
       (SELECT max(coletado_em) FROM bronze.coleta
        WHERE fonte = $1 AND status_http = 200) AS ultima_coleta_em`,
    [FONTE_CLIMA_HISTORICO],
  );
  const janela = janelaDoHistorico({
    primeiroAno: rows[0].primeiro_ano,
    carregadoDesde: rows[0].carregado_desde,
    ultimaColetaEm: rows[0].ultima_coleta_em,
    agora: new Date(),
  });
  if (!janela) return true;
  return gravarColeta(pool, await coletarClimaHistorico(janela));
}

// DEC-045: pluviômetros do Cemaden. Sem credencial no .env, fica desligado.
async function coletarChuvaMedida(pool: pg.Pool): Promise<boolean> {
  const credenciais = credenciaisCemaden();
  if (!credenciais) {
    console.log(`${FONTE_CEMADEN}: desligado (sem CEMADEN_EMAIL e CEMADEN_SENHA)`);
    return true;
  }
  return gravarColeta(pool, await coletarCemaden(credenciais));
}

// Chama as APIs e grava as respostas no bronze. Devolve false se alguma fonte
// falhou.
export async function coletar(pool: pg.Pool): Promise<boolean> {
  const openMeteo = await gravarColeta(pool, await coletarOpenMeteo());
  const cemaden = await coletarChuvaMedida(pool);
  const arboviroses = await coletarArboviroses(pool);
  const mapa = await coletarMapa(pool);
  const historico = await coletarHistorico(pool);
  return openMeteo && cemaden && arboviroses && mapa && historico;
}

// Leituras de uma fonte: cada coleta pendente vira upsert no gold, numa
// transação por coleta.
async function tratarLeituras(
  pool: pg.Pool,
  fonte: string,
  extrair: (payload: unknown, coletadoEm: Date) => Leitura[],
): Promise<boolean> {
  const { rows: coletas } = await pool.query<{
    id: string;
    payload: unknown;
    coletado_em: Date;
  }>(
    `SELECT id, payload, coletado_em
     FROM bronze.coleta
     WHERE fonte = $1 AND status_http = 200 AND processado_em IS NULL
     ORDER BY coletado_em`,
    [fonte],
  );

  let ok = true;
  for (const coleta of coletas) {
    const cliente = await pool.connect();
    try {
      await cliente.query('BEGIN');
      const leituras = extrair(coleta.payload, coleta.coletado_em);
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
  console.log(`${coletas.length} coletas pendentes do ${fonte} lidas`);
  return ok;
}

// DEC-045: a chuva do modelo sai do gold; a das coletas antigas fica no bronze.
async function apagarChuvaDoModelo(pool: pg.Pool): Promise<boolean> {
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM gold.leitura_climatica
       WHERE fonte = 'openmeteo' AND variavel = 'precipitacao_mm'`,
    );
    if (rowCount) console.log(`openmeteo: ${rowCount} leituras de chuva apagadas`);
    return true;
  } catch (erro) {
    console.error(`openmeteo: ${String(erro)}`);
    return false;
  }
}

// Depois dos limites (tratar), para a estação cair na RPA certa
async function tratarCemaden(pool: pg.Pool): Promise<boolean> {
  let limites: LimiteDaRpa[];
  try {
    const { rows } = await pool.query<{
      nome: string;
      limite: { coordinates: LimiteDaRpa['coordenadas'] };
    }>(
      `SELECT nome, limite FROM gold.territorio
       WHERE tipo = 'RPA' AND limite IS NOT NULL ORDER BY rpa`,
    );
    limites = rows.map((r) => ({
      territorio: r.nome,
      coordenadas: r.limite.coordinates,
    }));
  } catch (erro) {
    console.error(`${FONTE_CEMADEN}: ${String(erro)}`);
    return false;
  }
  return tratarLeituras(pool, FONTE_CEMADEN, (payload) =>
    extrairLeiturasCemaden(payload, limites),
  );
}

// DEC-035: cada bairro ganha a RPA de gold.bairro_rpa; bairro fora da lista
// ("NAO INFORMADO") fica no Recife. Roda em todo ciclo, e não só com coleta
// nova, para acertar também as linhas gravadas antes do catálogo.
const ATRIBUIR_RPA = `
  UPDATE gold.indicador_territorio i
  SET territorio = b.territorio
  FROM gold.bairro_rpa b
  WHERE i.fonte = $1 AND b.bairro = i.bairro AND i.territorio <> b.territorio`;

async function atribuirRpa(pool: pg.Pool): Promise<boolean> {
  try {
    const { rowCount } = await pool.query(ATRIBUIR_RPA, [FONTE_ARBOVIROSES]);
    if (rowCount) console.log(`${FONTE_ARBOVIROSES}: RPA em ${rowCount} linhas`);
    return true;
  } catch (erro) {
    console.error(`${FONTE_ARBOVIROSES}: ${String(erro)}`);
    return false;
  }
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
  if (pendentes.length === 0) return atribuirRpa(pool);

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
    await cliente.query(ATRIBUIR_RPA, [FONTE_ARBOVIROSES]);
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

// Fontes do mapa (DEC-038): com coleta nova, refaz o gold da fonte numa
// transação a partir da coleta mais recente de cada recurso.
async function refazerSeHouverNova(
  pool: pg.Pool,
  fonte: string,
  refazer: (cliente: pg.PoolClient, payloads: unknown[]) => Promise<number>,
): Promise<boolean> {
  const { rows: pendentes } = await pool.query<{ id: string }>(
    `SELECT id FROM bronze.coleta
     WHERE fonte = $1 AND status_http = 200 AND processado_em IS NULL`,
    [fonte],
  );
  if (pendentes.length === 0) return true;

  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const { rows: ultimas } = await cliente.query<{ payload: unknown }>(
      `SELECT DISTINCT ON (coalesce(payload->>'recurso', '')) payload
       FROM bronze.coleta
       WHERE fonte = $1 AND status_http = 200
       ORDER BY coalesce(payload->>'recurso', ''), coletado_em DESC`,
      [fonte],
    );
    const linhas = await refazer(
      cliente,
      ultimas.map((u) => u.payload),
    );
    await cliente.query(
      'UPDATE bronze.coleta SET processado_em = now() WHERE id = ANY($1)',
      [pendentes.map((p) => p.id)],
    );
    await cliente.query('COMMIT');
    console.log(`${fonte}: ${pendentes.length} coletas novas, ${linhas} linhas no gold`);
    return true;
  } catch (erro) {
    await cliente.query('ROLLBACK');
    console.error(`${fonte}: ${String(erro)}`);
    return false;
  } finally {
    cliente.release();
  }
}

// Bairro fora de gold.bairro_rpa fica no Recife (DEC-035)
async function gravarAreasDeRisco(
  cliente: pg.PoolClient,
  payloads: unknown[],
): Promise<number> {
  const areas = montarAreasDeRisco(payloads);
  await cliente.query('DELETE FROM gold.area_risco WHERE fonte = $1', [
    FONTE_AREAS_RISCO,
  ]);
  await cliente.query(
    `INSERT INTO gold.area_risco
       (fonte, regional, territorio, bairro, localidade, endereco, descricao,
        nivel, latitude, longitude)
     SELECT $1, a.regional, coalesce(b.territorio, 'Recife'), a.bairro,
            a.localidade, a.endereco, a.descricao, a.nivel, a.latitude,
            a.longitude
     FROM unnest($2::text[], $3::text[], $4::text[], $5::text[], $6::text[],
                 $7::smallint[], $8::numeric[], $9::numeric[])
       AS a(regional, bairro, localidade, endereco, descricao, nivel, latitude,
            longitude)
     LEFT JOIN gold.bairro_rpa b ON b.bairro = a.bairro`,
    [
      FONTE_AREAS_RISCO,
      areas.map((a) => a.regional),
      areas.map((a) => a.bairro),
      areas.map((a) => a.localidade),
      areas.map((a) => a.endereco),
      areas.map((a) => a.descricao),
      areas.map((a) => a.nivel),
      areas.map((a) => a.latitude),
      areas.map((a) => a.longitude),
    ],
  );
  return areas.length;
}

// PR-030: só bairros da lista da Prefeitura; um nome desconhecido falha a
// transação em vez de sumir com a população
async function gravarPopulacao(
  cliente: pg.PoolClient,
  payloads: unknown[],
): Promise<number> {
  const [payload] = payloads;
  const populacao = montarPopulacao(payload);
  await cliente.query('DELETE FROM gold.populacao_bairro');
  await cliente.query(
    `INSERT INTO gold.populacao_bairro (bairro, territorio, populacao, ano, fonte)
     SELECT p.bairro, b.territorio, p.populacao, $3, $4
     FROM unnest($1::text[], $2::int[]) AS p(bairro, populacao)
     JOIN gold.bairro_rpa b ON b.bairro = p.bairro`,
    [
      populacao.map((p) => p.bairro),
      populacao.map((p) => p.populacao),
      Number(VERSAO_POPULACAO),
      FONTE_POPULACAO,
    ],
  );
  const { rows } = await cliente.query<{ n: number }>(
    'SELECT count(*)::int AS n FROM gold.populacao_bairro',
  );
  if (rows[0].n !== populacao.length) {
    throw new Error(
      `${populacao.length - rows[0].n} bairros do IBGE fora de gold.bairro_rpa`,
    );
  }
  return rows[0].n;
}

async function gravarLimites(
  cliente: pg.PoolClient,
  payloads: unknown[],
): Promise<number> {
  const [payload] = payloads;
  const limites = montarLimites(payload);
  for (const { rpa, limite } of limites) {
    await cliente.query('UPDATE gold.territorio SET limite = $1 WHERE rpa = $2', [
      JSON.stringify(limite),
      rpa,
    ]);
  }
  return limites.length;
}

// Uma coleta mais nova revisa os dias que já existiam (DEC-042). Um INSERT só,
// com uma lista por coluna.
const UPSERT_CLIMA_DIARIO = `
  INSERT INTO gold.clima_diario
    (fonte, estacao, territorio, dia, chuva_mm, temp_media_c, temp_min_c,
     temp_max_c, umidade_media_pct)
  SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::date[],
                       $5::numeric[], $6::numeric[], $7::numeric[],
                       $8::numeric[], $9::numeric[])
  ON CONFLICT (fonte, estacao, dia) DO UPDATE SET
    chuva_mm = EXCLUDED.chuva_mm,
    temp_media_c = EXCLUDED.temp_media_c,
    temp_min_c = EXCLUDED.temp_min_c,
    temp_max_c = EXCLUDED.temp_max_c,
    umidade_media_pct = EXCLUDED.umidade_media_pct,
    atualizado_em = now()`;

async function tratarClimaHistorico(pool: pg.Pool): Promise<boolean> {
  const { rows: coletas } = await pool.query<{ id: string; payload: unknown }>(
    `SELECT id, payload FROM bronze.coleta
     WHERE fonte = $1 AND status_http = 200 AND processado_em IS NULL
     ORDER BY coletado_em`,
    [FONTE_CLIMA_HISTORICO],
  );

  let ok = true;
  for (const coleta of coletas) {
    const cliente = await pool.connect();
    try {
      await cliente.query('BEGIN');
      const dias = extrairDias(coleta.payload);
      await cliente.query(UPSERT_CLIMA_DIARIO, [
        dias.map((d) => d.fonte),
        dias.map((d) => d.estacao),
        dias.map((d) => d.territorio),
        dias.map((d) => d.dia),
        dias.map((d) => d.chuvaMm),
        dias.map((d) => d.tempMediaC),
        dias.map((d) => d.tempMinC),
        dias.map((d) => d.tempMaxC),
        dias.map((d) => d.umidadeMediaPct),
      ]);
      await cliente.query(
        'UPDATE bronze.coleta SET processado_em = now() WHERE id = $1',
        [coleta.id],
      );
      await cliente.query('COMMIT');
      console.log(`coleta ${coleta.id}: ${dias.length} dias de clima`);
    } catch (erro) {
      await cliente.query('ROLLBACK');
      console.error(`coleta ${coleta.id}: ${String(erro)}`);
      ok = false;
    } finally {
      cliente.release();
    }
  }
  return ok;
}

// Move as coletas pendentes do bronze para o gold. Devolve false se alguma
// falhou.
export async function tratar(pool: pg.Pool): Promise<boolean> {
  const openMeteo = await tratarLeituras(pool, 'openmeteo', extrairLeituras);
  const chuvaDoModelo = await apagarChuvaDoModelo(pool);
  const arboviroses = await tratarArboviroses(pool);
  const areas = await refazerSeHouverNova(
    pool,
    FONTE_AREAS_RISCO,
    gravarAreasDeRisco,
  );
  const populacao = await refazerSeHouverNova(
    pool,
    FONTE_POPULACAO,
    gravarPopulacao,
  );
  const limites = await refazerSeHouverNova(
    pool,
    FONTE_LIMITES_RPA,
    gravarLimites,
  );
  const cemaden = await tratarCemaden(pool);
  const historico = await tratarClimaHistorico(pool);
  return (
    openMeteo &&
    chuvaDoModelo &&
    arboviroses &&
    areas &&
    populacao &&
    limites &&
    cemaden &&
    historico
  );
}
