import type { Coleta } from './openmeteo.js';

// Fontes do mapa da EST-01 (DEC-038, TASK-071). Mudam pouco: o pipeline só
// baixa de novo quando o portal republica o arquivo (modificado_em) ou, no
// IBGE, quando muda o censo (VERSAO_POPULACAO).

export const FONTE_AREAS_RISCO = 'recife_areas_risco';
export const FONTE_LIMITES_RPA = 'recife_limites_rpa';
export const FONTE_POPULACAO = 'ibge_populacao';

export interface RecursoCkan {
  id: string;
  nome: string;
  url: string;
  // last_modified do CKAN: muda quando a Prefeitura republica o arquivo
  modificadoEm: string;
}

const CKAN = 'https://dados.recife.pe.gov.br/api/3/action';
// Áreas de risco da Defesa Civil: hoje só a Regional Sul está publicada
const CONJUNTO_DEFESA_CIVIL = 'defesa-civil';
const CONJUNTO_LIMITES = 'mapas-de-limites-e-divisoes-territoriais';
const RECURSO_LIMITES_RPA = '44682388-5a26-4190-9138-fd72a1048de1';

// Censo 2022, população residente por bairro do Recife (SIDRA 9923, N102)
export const VERSAO_POPULACAO = '2022';
const URL_POPULACAO =
  'https://servicodados.ibge.gov.br/api/v3/agregados/9923/periodos/2022/' +
  'variaveis/93?localidades=N102[N6[2611606]]&classificacao=1[6795]';

function isObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function recursoDe(r: Record<string, unknown>): RecursoCkan {
  return {
    id: String(r.id),
    nome: String(r.name ?? ''),
    url: String(r.url ?? ''),
    modificadoEm: String(r.last_modified ?? r.created ?? ''),
  };
}

// Os CSVs de áreas de risco do conjunto (um por regional, quando houver)
export function escolherAreasDeRisco(recursos: unknown[]): RecursoCkan[] {
  return recursos
    .filter(isObjeto)
    .filter(
      (r) =>
        String(r.format ?? '').toUpperCase() === 'CSV' &&
        /áreas de risco/i.test(String(r.name ?? '')),
    )
    .map(recursoDe);
}

async function recursosDoConjunto(conjunto: string): Promise<unknown[]> {
  const url = `${CKAN}/package_show?id=${conjunto}`;
  const resposta = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  const corpo: unknown = resposta.ok ? await resposta.json() : null;
  if (!isObjeto(corpo) || !isObjeto(corpo.result)) {
    throw new Error(`CKAN respondeu HTTP ${resposta.status} em ${url}`);
  }
  const recursos = corpo.result.resources;
  return Array.isArray(recursos) ? recursos : [];
}

export async function listarAreasDeRisco(): Promise<RecursoCkan[]> {
  return escolherAreasDeRisco(await recursosDoConjunto(CONJUNTO_DEFESA_CIVIL));
}

export async function recursoDosLimites(): Promise<RecursoCkan> {
  const recurso = (await recursosDoConjunto(CONJUNTO_LIMITES))
    .filter(isObjeto)
    .find((r) => r.id === RECURSO_LIMITES_RPA);
  if (!recurso) throw new Error('recurso "Limites por RPA" não encontrado');
  return recursoDe(recurso);
}

// CSV da Prefeitura: separado por ";", campos entre aspas, primeira linha com
// os nomes das colunas
export function lerCsv(texto: string): Record<string, string>[] {
  const linhas: string[][] = [];
  let campo = '';
  let linha: string[] = [];
  let aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"' && texto[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') {
        aspas = false;
      } else {
        campo += c;
      }
    } else if (c === '"') {
      aspas = true;
    } else if (c === ';') {
      linha.push(campo);
      campo = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      linha.push(campo);
      if (linha.some((v) => v !== '')) linhas.push(linha);
      linha = [];
      campo = '';
    } else {
      campo += c;
    }
  }
  linha.push(campo);
  if (linha.some((v) => v !== '')) linhas.push(linha);

  const [cabecalho, ...dados] = linhas;
  if (!cabecalho) return [];
  const nomes = cabecalho.map((n) => n.replace(/^\uFEFF/, '').trim());
  return dados.map((valores) =>
    Object.fromEntries(nomes.map((nome, i) => [nome, valores[i] ?? ''])),
  );
}

async function baixar(
  fonte: string,
  url: string,
  montar: (resposta: Response) => Promise<unknown>,
): Promise<Coleta> {
  try {
    const resposta = await fetch(url, { signal: AbortSignal.timeout(120_000) });
    const payload = resposta.ok
      ? await montar(resposta)
      : { erro: await resposta.text() };
    return { fonte, url, statusHttp: resposta.status, payload };
  } catch (erro) {
    // Falha de rede ou timeout: sem status HTTP, registrado como 0
    return { fonte, url, statusHttp: 0, payload: { erro: String(erro) } };
  }
}

export function coletarAreasDeRisco(recurso: RecursoCkan): Promise<Coleta> {
  return baixar(FONTE_AREAS_RISCO, recurso.url, async (resposta) => ({
    recurso: recurso.id,
    modificado_em: recurso.modificadoEm,
    linhas: lerCsv(await resposta.text()),
  }));
}

export function coletarLimitesRpa(recurso: RecursoCkan): Promise<Coleta> {
  return baixar(FONTE_LIMITES_RPA, recurso.url, async (resposta) => ({
    recurso: recurso.id,
    modificado_em: recurso.modificadoEm,
    geojson: (await resposta.json()) as unknown,
  }));
}

export function coletarPopulacao(): Promise<Coleta> {
  return baixar(FONTE_POPULACAO, URL_POPULACAO, async (resposta) => ({
    versao: VERSAO_POPULACAO,
    resposta: (await resposta.json()) as unknown,
  }));
}
