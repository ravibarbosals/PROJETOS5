import {
  type AcaoBoletim,
  montarDocumentoBoletim,
  ordenarSecoes,
} from '@/modules/boletins/domain/documento-boletim';
import type { ResumoMeteorologico } from '@/modules/boletins/domain/resumo-meteorologico';
import { SecaoBoletim } from '@/modules/boletins/enums/secao-boletim.enum';

const GERADO_EM = new Date('2026-11-02T12:00:00Z');

const ACAO: AcaoBoletim = {
  descricao: 'Equipe enviada',
  autor: 'Camila Rocha',
  registradaEm: new Date('2026-11-02T10:20:00Z'),
  idAlerta: 10,
};

const montar = (secoes: SecaoBoletim[], acoes: AcaoBoletim[] = []) =>
  montarDocumentoBoletim(secoes, { geradoEm: GERADO_EM, acoes });

const secao = (secoes: SecaoBoletim[], acoes: AcaoBoletim[] = []) =>
  montar(secoes, acoes).secoes[0];

describe('ordenarSecoes (RN-009 #1, PR-022 d)', () => {
  it('puts the sections in the RN-009 order', () => {
    expect(
      ordenarSecoes([
        SecaoBoletim.Contatos,
        SecaoBoletim.Cabecalho,
        SecaoBoletim.Rios,
      ]),
    ).toEqual([
      SecaoBoletim.Cabecalho,
      SecaoBoletim.Rios,
      SecaoBoletim.Contatos,
    ]);
  });

  it('keeps a repeated section once', () => {
    expect(ordenarSecoes([SecaoBoletim.Rios, SecaoBoletim.Rios])).toEqual([
      SecaoBoletim.Rios,
    ]);
  });
});

describe('montarDocumentoBoletim (RN-009, PR-022)', () => {
  it('has only the chosen sections, with their titles', () => {
    const documento = montar([
      SecaoBoletim.AcoesAbrigos,
      SecaoBoletim.Meteorologia,
    ]);

    expect(documento.geradoEm).toBe(GERADO_EM);
    expect(documento.secoes.map((s) => [s.secao, s.titulo])).toEqual([
      [SecaoBoletim.Meteorologia, 'Situação meteorológica'],
      [SecaoBoletim.AcoesAbrigos, 'Ações em curso e abrigos'],
    ]);
  });

  it('header: institution and generation time in Recife (PR-022 a)', () => {
    expect(secao([SecaoBoletim.Cabecalho])).toEqual({
      secao: SecaoBoletim.Cabecalho,
      titulo: 'Boletim de Emergência Climática',
      blocos: [
        {
          tipo: 'paragrafo',
          texto: 'Secretaria Executiva de Vigilância em Saúde do Recife',
        },
        { tipo: 'paragrafo', texto: 'Gerado em 02/11/2026, 09:00' },
      ],
    });
  });

  it('actions: one line per action, with author and linked alert (PR-022 b)', () => {
    const semAlerta = {
      ...ACAO,
      descricao: 'Abrigo vistoriado',
      idAlerta: null,
    };

    expect(
      secao([SecaoBoletim.AcoesAbrigos], [ACAO, semAlerta]).blocos,
    ).toEqual([
      {
        tipo: 'lista',
        itens: [
          '02/11/2026, 07:20: Equipe enviada (Camila Rocha, alerta nº 10)',
          '02/11/2026, 07:20: Abrigo vistoriado (Camila Rocha)',
        ],
      },
      {
        tipo: 'aviso',
        texto: 'Informações de abrigos ainda não estão disponíveis no sistema.',
      },
    ]);
  });

  it('actions: says so when there is none', () => {
    expect(secao([SecaoBoletim.AcoesAbrigos]).blocos[0]).toEqual({
      tipo: 'paragrafo',
      texto: 'Nenhuma ação registrada nas últimas 24 horas.',
    });
  });

  it('rivers: unavailable until there is a source (PR-022 c)', () => {
    expect(secao([SecaoBoletim.Rios]).blocos).toEqual([
      {
        tipo: 'aviso',
        texto:
          'Conteúdo indisponível: estes dados ainda não estão integrados ao sistema.',
      },
    ]);
  });

  describe('weather (TASK-032)', () => {
    const RESUMO: ResumoMeteorologico = {
      chuvaAcumulada: 0.4,
      chuvaUltimaHora: { valor: 0, lidaEm: new Date('2026-11-02T11:00:00Z') },
      temperaturaMaxima: {
        valor: 31.4,
        lidaEm: new Date('2026-11-02T16:00:00Z'),
      },
      umidadeAtual: null,
      fontes: ['openmeteo'],
      atualizadaEm: new Date('2026-11-02T11:41:00Z'),
    };

    const meteorologia = (resumo: ResumoMeteorologico | null) =>
      montarDocumentoBoletim([SecaoBoletim.Meteorologia], {
        geradoEm: GERADO_EM,
        acoes: [],
        meteorologia: resumo,
      }).secoes[0].blocos;

    it('lists the EST-01 numbers and names the source with its update time (PR-013, REQ-019)', () => {
      expect(meteorologia(RESUMO)).toEqual([
        {
          tipo: 'lista',
          itens: [
            'Chuva acumulada (últimas 24 h): 0,4 mm',
            'Chuva na última hora: 0 mm (02/11/2026, 08:00)',
            'Temperatura máxima (últimas 24 h): 31,4 °C (02/11/2026, 13:00)',
            'Umidade atual: sem leitura',
          ],
        },
        {
          tipo: 'paragrafo',
          texto:
            'Fonte: Open-Meteo (modelo meteorológico) · atualizada em 02/11/2026, 08:41',
        },
      ]);
    });

    it('cites the Cemaden network when its rain gauges are a source (DEC-036)', () => {
      expect(
        meteorologia({ ...RESUMO, fontes: ['cemaden', 'openmeteo'] }).slice(1),
      ).toEqual([
        {
          tipo: 'paragrafo',
          texto:
            'Fonte: Cemaden (pluviômetros), Open-Meteo (modelo meteorológico) · atualizada em 02/11/2026, 08:41',
        },
        {
          tipo: 'paragrafo',
          texto: 'DADOS DA REDE OBSERVACIONAL DO CEMADEN/MCTIC',
        },
      ]);
    });

    it('says when the source has no collection on record (RN-007 #2)', () => {
      expect(
        meteorologia({ ...RESUMO, fontes: ['apac'], atualizadaEm: null })[1],
      ).toEqual({
        tipo: 'paragrafo',
        texto: 'Fonte: apac · sem coleta registrada',
      });
    });

    it('says so when there is no reading in the last 24 h', () => {
      expect(meteorologia(null)).toEqual([
        {
          tipo: 'aviso',
          texto: 'Sem leituras meteorológicas do Recife nas últimas 24 horas.',
        },
      ]);
    });
  });

  it.each([SecaoBoletim.RiscosSaude, SecaoBoletim.Contatos])(
    '%s: unavailable until DUV-033 (PR-022 c)',
    (escolhida) => {
      expect(secao([escolhida]).blocos).toEqual([
        {
          tipo: 'aviso',
          texto:
            'Conteúdo indisponível: a origem deste conteúdo ainda não foi definida.',
        },
      ]);
    },
  );
});
