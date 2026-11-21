import type { Coleta } from './openmeteo.js';

export type Agravo = 'dengue' | 'chikungunya' | 'zika';

export interface Recurso {
  id: string;
  agravo: Agravo;
  ano: number;
  // last_modified do CKAN: muda quando a prefeitura republica o arquivo
  modificadoEm: string;
}

export interface Contagem {
  bairro: string;
  // Semana epidemiológica do SINAN, no formato AAAASS (ex.: 202501)
  semana: string;
  casos: number;
}

export const FONTE = 'recife_arboviroses';

const CKAN = 'https://dados.recife.pe.gov.br/api/3/action';
const CONJUNTO = 'casos-de-dengue-zika-e-chikungunya';

// DEC-043: os 5 anos mais recentes publicados de cada agravo (hoje 2021 a
// 2025). Antes de 2021 o portal usa outro formato de colunas (TASK-082).
export const ANOS = 5;

// Sobe quando a forma de contar muda: coletas de outra versão são baixadas de
// novo, mesmo que o portal não tenha republicado o arquivo. 2: bairro pelo
// código da ficha (TASK-063); 3: só as fichas do próprio agravo (TASK-074)
export const VERSAO_CONTAGEM = 3;

// Maior página que a API devolve
const PAGINA = 500;

// Código de "descartado" na classificação final (CLASSI_FIN) de cada ficha
// do SINAN. Caso provável = notificação que não foi descartada (DEC-031)
const DESCARTADO: Record<Agravo, string> = {
  dengue: '5',
  chikungunya: '5',
  zika: '2',
};

// CID-10 de cada agravo, sem o ponto (o portal grava "A92.0" e "A928").
const CID: Record<Agravo, string> = {
  dengue: 'A90',
  chikungunya: 'A920',
  zika: 'A928',
};

// Só as colunas que a contagem usa: o resto da ficha (nascimento, endereço,
// CEP) nunca sai da API (REQ-014). Alguns anos vêm com os nomes em minúsculas
const COLUNAS = ['ID_AGRAVO', 'ID_BAIRRO', 'NM_BAIRRO', 'SEM_NOT', 'CLASSI_FIN'];

export const SEM_BAIRRO = 'NAO INFORMADO';

function isObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function agravoDoNome(nome: string): Agravo | null {
  const texto = nome.toLowerCase();
  if (texto.includes('dengue')) return 'dengue';
  if (texto.includes('chikungunya')) return 'chikungunya';
  if (texto.includes('zika')) return 'zika';
  return null;
}

// Da lista de recursos do conjunto, os CSVs de casos dos anos mais recentes de
// cada agravo. Metadados e tabelas auxiliares (bairros, UF) ficam de fora.
export function escolherRecursos(recursos: unknown[], anos = ANOS): Recurso[] {
  const candidatos: Recurso[] = [];
  for (const r of recursos) {
    if (!isObjeto(r) || r.datastore_active !== true) continue;
    const nome = String(r.name ?? '');
    const agravo = agravoDoNome(nome);
    const ano = /\b(20\d{2})\b/.exec(nome)?.[1];
    if (!agravo || !ano || nome.toLowerCase().includes('metadado')) continue;
    candidatos.push({
      id: String(r.id),
      agravo,
      ano: Number(ano),
      modificadoEm: String(r.last_modified ?? r.created ?? ''),
    });
  }

  return (['dengue', 'chikungunya', 'zika'] as const).flatMap((agravo) =>
    candidatos
      .filter((c) => c.agravo === agravo)
      .sort((a, b) => b.ano - a.ano)
      .slice(0, anos),
  );
}

// Valor de uma coluna sem depender de maiúsculas e minúsculas no nome
function campo(linha: Record<string, unknown>, nome: string): string {
  const valor = linha[nome] ?? linha[nome.toLowerCase()];
  return valor === null || valor === undefined ? '' : String(valor);
}

// Maiúsculas, sem acento e sem espaço sobrando: "Campo  Grande" = "CAMPO GRANDE"
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

// TASK-063: com o código do bairro (ID_BAIRRO), o nome vem padronizado. Sem
// código, o nome foi digitado à mão e às vezes chega truncado ou com acento
// quebrado ("JIQU]", "VASC"); só vale se for igual a um bairro com código do
// mesmo arquivo. O resto conta como não informado.
function resolverBairros(linhas: Record<string, unknown>[]) {
  const conhecidos = new Set(
    linhas
      .filter((l) => campo(l, 'ID_BAIRRO') !== '')
      .map((l) => normalizar(campo(l, 'NM_BAIRRO')))
      .filter((nome) => nome !== ''),
  );
  return (linha: Record<string, unknown>): string => {
    const nome = normalizar(campo(linha, 'NM_BAIRRO'));
    return conhecidos.has(nome) ? nome : SEM_BAIRRO;
  };
}

// DEC-043: uma ficha com o CID de outro agravo não conta. O arquivo "Zika
// 2021" do portal é cópia do de chikungunya (só A92.0); sem isto, os casos de
// chikungunya contariam duas vezes. CID em branco segue o agravo do arquivo.
function deOutroAgravo(linha: Record<string, unknown>, agravo: Agravo) {
  const cid = campo(linha, 'ID_AGRAVO').replace('.', '').trim().toUpperCase();
  return cid !== '' && cid !== CID[agravo];
}

// Conta os casos prováveis por bairro e semana. Recebe as linhas como a API
// devolve; o que sai daqui é só contagem.
export function contarCasos(
  linhas: unknown[],
  agravo: Agravo,
): {
  contagens: Contagem[];
  descartadas: number;
  semSemana: number;
  outroAgravo: number;
} {
  const validas = linhas.filter(isObjeto);
  const bairroDe = resolverBairros(validas);
  const porChave = new Map<string, Contagem>();
  let descartadas = 0;
  let semSemana = 0;
  let outroAgravo = 0;

  for (const linha of validas) {
    if (deOutroAgravo(linha, agravo)) {
      outroAgravo += 1;
      continue;
    }
    if (campo(linha, 'CLASSI_FIN') === DESCARTADO[agravo]) {
      descartadas += 1;
      continue;
    }
    const semana = campo(linha, 'SEM_NOT');
    if (!/^\d{6}$/.test(semana)) {
      semSemana += 1;
      continue;
    }
    const bairro = bairroDe(linha);
    const chave = `${bairro}|${semana}`;
    const atual = porChave.get(chave);
    if (atual) {
      atual.casos += 1;
    } else {
      porChave.set(chave, { bairro, semana, casos: 1 });
    }
  }

  return {
    contagens: [...porChave.values()],
    descartadas,
    semSemana,
    outroAgravo,
  };
}

async function getJson(
  url: string,
): Promise<{ status: number; corpo: unknown }> {
  const resposta = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  const corpo: unknown = resposta.ok
    ? await resposta.json()
    : { erro: await resposta.text() };
  return { status: resposta.status, corpo };
}

// Lista os recursos do conjunto no CKAN
export async function listarRecursos(): Promise<Recurso[]> {
  const url = `${CKAN}/package_show?id=${CONJUNTO}`;
  const { status, corpo } = await getJson(url);
  if (status !== 200 || !isObjeto(corpo) || !isObjeto(corpo.result)) {
    throw new Error(`CKAN respondeu HTTP ${status} em ${url}`);
  }
  const recursos = corpo.result.resources;
  return escolherRecursos(Array.isArray(recursos) ? recursos : []);
}

// Nomes das colunas como estão no recurso (maiúsculas ou minúsculas)
async function colunasDoRecurso(id: string): Promise<string[]> {
  const url = `${CKAN}/datastore_search?resource_id=${id}&limit=0`;
  const { status, corpo } = await getJson(url);
  if (status !== 200 || !isObjeto(corpo) || !isObjeto(corpo.result)) {
    throw new Error(`CKAN respondeu HTTP ${status} em ${url}`);
  }
  const campos = Array.isArray(corpo.result.fields) ? corpo.result.fields : [];
  const existentes = new Map(
    campos
      .filter(isObjeto)
      .map((f) => [String(f.id).toUpperCase(), String(f.id)]),
  );
  return COLUNAS.map((nome) => {
    const real = existentes.get(nome);
    if (!real) throw new Error(`recurso ${id} sem a coluna ${nome}`);
    return real;
  });
}

// Baixa um recurso página por página e devolve a coleta já agregada
export async function coletarRecurso(recurso: Recurso): Promise<Coleta> {
  let base = `${CKAN}/datastore_search?resource_id=${recurso.id}`;

  try {
    base +=
      '&' +
      new URLSearchParams({
        fields: (await colunasDoRecurso(recurso.id)).join(','),
        limit: String(PAGINA),
      }).toString();

    const linhas: unknown[] = [];
    let total = Infinity;
    while (linhas.length < total) {
      const { status, corpo } = await getJson(
        `${base}&offset=${linhas.length}`,
      );
      if (status !== 200 || !isObjeto(corpo) || !isObjeto(corpo.result)) {
        return { fonte: FONTE, url: base, statusHttp: status, payload: corpo };
      }
      const pagina = corpo.result.records;
      total = Number(corpo.result.total);
      if (!Array.isArray(pagina) || pagina.length === 0) break;
      linhas.push(...pagina);
    }

    const { contagens, descartadas, semSemana, outroAgravo } = contarCasos(
      linhas,
      recurso.agravo,
    );
    return {
      fonte: FONTE,
      url: base,
      statusHttp: 200,
      payload: {
        recurso: recurso.id,
        agravo: recurso.agravo,
        ano: recurso.ano,
        modificado_em: recurso.modificadoEm,
        versao: VERSAO_CONTAGEM,
        linhas: linhas.length,
        descartadas,
        sem_semana: semSemana,
        outro_agravo: outroAgravo,
        contagens,
      },
    };
  } catch (erro) {
    // Falha de rede, timeout ou coluna ausente: sem status HTTP, registrado
    // como 0
    return {
      fonte: FONTE,
      url: base,
      statusHttp: 0,
      payload: { erro: String(erro) },
    };
  }
}
