import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { lerCsv } from '../coletores/mapa.js';
import {
  montarAreasDeRisco,
  montarLimites,
  montarPopulacao,
} from './mapa.js';

describe('lerCsv', () => {
  it('reads the Prefeitura CSV: ";" separator, quotes and header', () => {
    const texto =
      '"regional";"bairro";"descricao"\r\n' +
      '"Sul";"Ibura";"Área de Risco Nível 3"\r\n' +
      '"Sul";"Jordão";"Ponto; com ""aspas"""\r\n';

    assert.deepEqual(lerCsv(texto), [
      { regional: 'Sul', bairro: 'Ibura', descricao: 'Área de Risco Nível 3' },
      { regional: 'Sul', bairro: 'Jordão', descricao: 'Ponto; com "aspas"' },
    ]);
  });
});

describe('montarAreasDeRisco', () => {
  const linha = {
    regional: 'Sul',
    endereco: 'Rua Doutor Cézar Montezuma 46',
    bairro: 'Jordão',
    localidade: 'Lagoa Encantada',
    descricao: 'Área de Risco Nível 3',
    latitude: ' -8.128689',
    longitude: '-34.950349',
  };

  it('keeps the level, the normalized bairro and the coordinates', () => {
    assert.deepEqual(montarAreasDeRisco([{ linhas: [linha] }]), [
      {
        regional: 'Sul',
        bairro: 'JORDAO',
        localidade: 'Lagoa Encantada',
        endereco: 'Rua Doutor Cézar Montezuma 46',
        descricao: 'Área de Risco Nível 3',
        nivel: 3,
        latitude: -8.128689,
        longitude: -34.950349,
      },
    ]);
  });

  it('leaves points without a level, like tarp points, with nivel null', () => {
    const [area] = montarAreasDeRisco([
      { linhas: [{ ...linha, descricao: 'Ponto de Colocação de Lona' }] },
    ]);

    assert.equal(area.nivel, null);
  });

  it('skips rows without valid coordinates', () => {
    const areas = montarAreasDeRisco([
      { linhas: [{ ...linha, latitude: '' }, { ...linha, longitude: 'x' }] },
    ]);

    assert.equal(areas.length, 0);
  });
});

describe('montarPopulacao', () => {
  const serie = (nome: string, valor: string) => ({
    localidade: { nome: `${nome} - Recife - PE` },
    serie: { '2022': valor },
  });

  it('reads one bairro per series, with the name as in gold.bairro_rpa', () => {
    const payload = {
      versao: '2022',
      resposta: [
        {
          resultados: [
            {
              series: [
                serie('Santo Amaro', '27103'),
                serie('Sítio dos Pintos - São Brás', '5000'),
              ],
            },
          ],
        },
      ],
    };

    assert.deepEqual(montarPopulacao(payload), [
      { bairro: 'SANTO AMARO', populacao: 27103 },
      { bairro: 'SITIO DOS PINTOS', populacao: 5000 },
    ]);
  });

  it('rejects a payload without series', () => {
    assert.throws(() => montarPopulacao({ resposta: [] }), /sem séries/);
  });
});

describe('montarLimites', () => {
  const quadrado = [
    [
      [290000, 9110000],
      [291000, 9110000],
      [291000, 9111000],
      [290000, 9111000],
      [290000, 9110000],
    ],
  ];
  const geojson = (crs: string) => ({
    geojson: {
      crs: { type: 'name', properties: { name: crs } },
      features: [
        {
          properties: { CRPAAACODI: 4 },
          geometry: { type: 'MultiPolygon', coordinates: [quadrado] },
        },
      ],
    },
  });

  it('converts each RPA to longitude/latitude', () => {
    const [limite] = montarLimites(geojson('urn:ogc:def:crs:EPSG::31985'));

    assert.equal(limite.rpa, 4);
    assert.deepEqual(limite.limite.coordinates[0][0][0], [-34.90552, -8.04716]);
    assert.equal(limite.limite.coordinates[0][0].length, 5);
  });

  it('refuses a file in another projection', () => {
    assert.throws(
      () => montarLimites(geojson('urn:ogc:def:crs:EPSG::4326')),
      /fora do EPSG:31985/,
    );
  });
});
