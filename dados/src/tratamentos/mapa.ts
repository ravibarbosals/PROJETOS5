import { simplificar, utm25sParaGraus, type Ponto } from './geo.js';

// Tratamentos das fontes do mapa da EST-01 (DEC-038, TASK-071). A RPA de cada
// bairro vem de gold.bairro_rpa na hora de gravar (pipeline.ts).

export interface AreaRisco {
  regional: string;
  bairro: string;
  localidade: string;
  endereco: string;
  descricao: string;
  // "Área de Risco Nível 3" -> 3; pontos de lona e afins ficam sem nível
  nivel: number | null;
  latitude: number;
  longitude: number;
}

export interface PopulacaoBairro {
  bairro: string;
  populacao: number;
}

export interface LimiteRpa {
  rpa: number;
  // GeoJSON MultiPolygon em longitude/latitude (WGS84)
  limite: { type: 'MultiPolygon'; coordinates: Ponto[][][] };
}

// Tolerância da simplificação dos limites, em metros: some ~90% dos vértices
// e o contorno continua igual na escala da cidade
const TOLERANCIA_M = 10;

// Nome do IBGE -> nome da lista de bairros da Prefeitura (gold.bairro_rpa)
const APELIDOS: Record<string, string> = {
  'SITIO DOS PINTOS - SAO BRAS': 'SITIO DOS PINTOS',
};

function isObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

// Maiúsculas, sem acento e sem espaço sobrando, como em gold.bairro_rpa
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

const numero = (texto: string) => Number(texto.trim().replace(',', '.'));

// Junta os CSVs de áreas de risco (um por regional). Linha sem coordenada
// válida não entra no mapa.
export function montarAreasDeRisco(payloads: unknown[]): AreaRisco[] {
  const areas: AreaRisco[] = [];
  for (const payload of payloads) {
    if (!isObjeto(payload) || !Array.isArray(payload.linhas)) {
      throw new Error('payload de áreas de risco sem linhas');
    }
    for (const linha of payload.linhas) {
      if (!isObjeto(linha)) continue;
      const texto = (nome: string) => String(linha[nome] ?? '').trim();
      const latitude = numero(texto('latitude'));
      const longitude = numero(texto('longitude'));
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
      if (latitude === 0 || longitude === 0) continue;
      const descricao = texto('descricao');
      const nivel = /n[ií]vel\s*(\d)/i.exec(descricao)?.[1];
      areas.push({
        regional: texto('regional'),
        bairro: normalizar(texto('bairro')),
        localidade: texto('localidade'),
        endereco: texto('endereco'),
        descricao,
        nivel: nivel ? Number(nivel) : null,
        latitude,
        longitude,
      });
    }
  }
  return areas;
}

// Resposta do SIDRA (agregado 9923): uma série por bairro, com o nome no
// formato "Santo Amaro - Recife - PE"
export function montarPopulacao(payload: unknown): PopulacaoBairro[] {
  const resposta = isObjeto(payload) ? payload.resposta : undefined;
  const series = Array.isArray(resposta)
    ? (resposta[0] as { resultados?: { series?: unknown[] }[] })?.resultados?.[0]
        ?.series
    : undefined;
  if (!Array.isArray(series)) {
    throw new Error('payload do IBGE sem séries de população');
  }
  return series.filter(isObjeto).map((serie) => {
    const local = isObjeto(serie.localidade) ? String(serie.localidade.nome) : '';
    const valor = isObjeto(serie.serie) ? Number(serie.serie['2022']) : NaN;
    if (!local || !Number.isInteger(valor) || valor < 0) {
      throw new Error(`população inválida em "${local}"`);
    }
    const nome = normalizar(local.replace(/ - Recife - PE$/, ''));
    return { bairro: APELIDOS[nome] ?? nome, populacao: valor };
  });
}

function anelEmGraus(anel: unknown): Ponto[] {
  if (!Array.isArray(anel)) throw new Error('anel inválido nos limites');
  const pontos = anel.map((p): Ponto => {
    if (!Array.isArray(p) || typeof p[0] !== 'number' || typeof p[1] !== 'number') {
      throw new Error('coordenada inválida nos limites');
    }
    return [p[0], p[1]];
  });
  const simples = simplificar(pontos, TOLERANCIA_M);
  // Um anel precisa de 4 pontos (o último repete o primeiro)
  return (simples.length >= 4 ? simples : pontos).map((p) => {
    const [lon, lat] = utm25sParaGraus(p);
    return [Math.round(lon * 1e5) / 1e5, Math.round(lat * 1e5) / 1e5];
  });
}

// "Limites por RPA - 2023": um MultiPolygon por RPA em EPSG:31985
export function montarLimites(payload: unknown): LimiteRpa[] {
  const geojson = isObjeto(payload) ? payload.geojson : undefined;
  if (!isObjeto(geojson) || !Array.isArray(geojson.features)) {
    throw new Error('payload dos limites sem features');
  }
  const crs = JSON.stringify(geojson.crs ?? '');
  if (!crs.includes('31985')) {
    throw new Error(`limites fora do EPSG:31985: ${crs}`);
  }
  return geojson.features.filter(isObjeto).map((feature) => {
    const rpa = isObjeto(feature.properties)
      ? Number(feature.properties.CRPAAACODI)
      : NaN;
    const geometria = isObjeto(feature.geometry) ? feature.geometry : {};
    if (!Number.isInteger(rpa) || rpa < 1 || rpa > 6) {
      throw new Error('feature dos limites sem RPA de 1 a 6');
    }
    const poligonos =
      geometria.type === 'Polygon'
        ? [geometria.coordinates]
        : geometria.type === 'MultiPolygon'
          ? geometria.coordinates
          : null;
    if (!Array.isArray(poligonos)) {
      throw new Error(`RPA ${rpa} sem polígono`);
    }
    return {
      rpa,
      limite: {
        type: 'MultiPolygon' as const,
        coordinates: poligonos.map((poligono) => {
          if (!Array.isArray(poligono)) throw new Error(`RPA ${rpa} inválida`);
          return poligono.map(anelEmGraus);
        }),
      },
    };
  });
}
