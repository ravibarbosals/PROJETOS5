import { Papel } from '@/modules/acesso/enums/papel.enum';
import { MotivoEncerramento } from '@/modules/alertas/enums/motivo-encerramento.enum';
import { NivelAlerta } from '@/modules/alertas/enums/nivel-alerta.enum';
import { OperacaoHistorico } from '@/modules/alertas/enums/operacao-historico.enum';
import { TipoAcaoManual } from '@/modules/alertas/enums/tipo-acao-manual.enum';

// TASK-050. Dados fictícios de demonstração, com datas relativas a "agora".
// Valores ilustrativos: os parâmetros reais são do Vigidesastres (DUV-018).
// Variáveis, fonte e território são os do gold real (Open-Meteo, Recife), para
// o job de alertas (DEC-029) tratar os dados de demonstração como os reais.

export const DOMINIO_DEMO = 'demo.vigia.local';

const FONTE = 'openmeteo';
const ESTACAO = 'recife';
const TERRITORIO = 'Recife';
const MINUTO_MS = 60_000;
const HORA_MS = 60 * MINUTO_MS;
const DIA_MS = 24 * HORA_MS;
const RECIFE_UTC = -3;

export type ChaveParametro =
  'chuvaModerado' | 'chuvaAlto' | 'temperaturaModerado' | 'umidadeModerado';

export interface UsuarioDemo {
  nome: string;
  email: string;
  papel: Papel;
}

export interface ParametroDemo {
  chave: ChaveParametro;
  variavel: string;
  territorio: string;
  limiar: number;
  limiarSaida: number;
  janelaHoras: number;
  nivel: NivelAlerta;
  ativo: boolean;
}

export interface HistoricoDemo {
  parametro: ChaveParametro;
  papel: Papel;
  operacao: OperacaoHistorico;
  anterior: Record<string, string | number | boolean> | null;
  novo: Record<string, string | number | boolean>;
  em: Date;
}

export interface AcaoManualDemo {
  papel: Papel;
  tipo: TipoAcaoManual;
  motivo: string;
  prorrogadoAte: Date | null;
  em: Date;
}

export interface AcaoDemo {
  papel: Papel;
  descricao: string;
  em: Date;
}

export interface AlertaDemo {
  // Parâmetro atual do alerta (o de maior nível, se escalonou).
  parametro: ChaveParametro;
  valorLido: number;
  lidaEm: Date;
  valorMaximo: number;
  ultimaLeituraEm: Date;
  disparo: Date;
  escalonamento: Date | null;
  prorrogadoAte: Date | null;
  encerramento: Date | null;
  motivoEncerramento: MotivoEncerramento | null;
  acoesManuais: AcaoManualDemo[];
  acoes: AcaoDemo[];
}

export interface CenarioDemo {
  usuarios: UsuarioDemo[];
  parametros: ParametroDemo[];
  historico: HistoricoDemo[];
  alertas: AlertaDemo[];
  // Ações sem alerta ligado (REQ-006).
  acoesAvulsas: AcaoDemo[];
}

export const USUARIOS_DEMO: UsuarioDemo[] = [
  {
    nome: 'Técnico(a) Demo',
    email: `tecnico@${DOMINIO_DEMO}`,
    papel: Papel.Tecnico,
  },
  {
    nome: 'Gestor(a) Demo',
    email: `gestor@${DOMINIO_DEMO}`,
    papel: Papel.Gestor,
  },
  {
    nome: 'Gestão Institucional Demo',
    email: `gestao@${DOMINIO_DEMO}`,
    papel: Papel.GestaoInstitucional,
  },
  {
    nome: 'Comunicação Demo',
    email: `comunicacao@${DOMINIO_DEMO}`,
    papel: Papel.Comunicacao,
  },
];

const PARAMETROS: ParametroDemo[] = [
  {
    chave: 'chuvaModerado',
    variavel: 'precipitacao_mm',
    territorio: TERRITORIO,
    limiar: 30,
    limiarSaida: 10,
    janelaHoras: 24,
    nivel: NivelAlerta.Moderado,
    ativo: true,
  },
  {
    chave: 'chuvaAlto',
    variavel: 'precipitacao_mm',
    territorio: TERRITORIO,
    limiar: 60,
    limiarSaida: 25,
    janelaHoras: 24,
    nivel: NivelAlerta.Alto,
    ativo: true,
  },
  {
    chave: 'temperaturaModerado',
    variavel: 'temperatura_c',
    territorio: TERRITORIO,
    limiar: 35,
    limiarSaida: 33,
    janelaHoras: 1,
    nivel: NivelAlerta.Moderado,
    ativo: true,
  },
  {
    chave: 'umidadeModerado',
    variavel: 'umidade_pct',
    territorio: TERRITORIO,
    limiar: 95,
    limiarSaida: 85,
    janelaHoras: 1,
    nivel: NivelAlerta.Moderado,
    ativo: false,
  },
];

// Campos do histórico com os nomes da API (RN-001), como o service grava.
function camposApi(
  p: ParametroDemo,
): Record<string, string | number | boolean> {
  return {
    variavel: p.variavel,
    territorio: p.territorio,
    limiar: p.limiar,
    limiar_saida: p.limiarSaida,
    janela_horas: p.janelaHoras,
    nivel: p.nivel,
    ativo: true,
  };
}

// Hora cheia anterior: as leituras do gold são horárias.
function horaCheia(data: Date): Date {
  return new Date(Math.floor(data.getTime() / HORA_MS) * HORA_MS);
}

export function cenarioDemo(agora: Date): CenarioDemo {
  const dias = (d: number) => new Date(agora.getTime() - d * 24 * HORA_MS);
  // Hora cheia no horário do Recife (UTC-3, sem horário de verão), d dias
  // antes de hoje: chuva forte de madrugada, calor à tarde.
  const diaAs = (d: number, horaRecife: number) => {
    const hoje = Math.floor((agora.getTime() + RECIFE_UTC * HORA_MS) / DIA_MS);
    return new Date((hoje - d) * DIA_MS + (horaRecife - RECIFE_UTC) * HORA_MS);
  };
  const depois = (base: Date, horas: number, minutos = 0) =>
    new Date(base.getTime() + horas * HORA_MS + minutos * MINUTO_MS);

  const criadoEm = dias(30);
  const historico: HistoricoDemo[] = PARAMETROS.map((p, i) => ({
    parametro: p.chave,
    papel: Papel.Gestor,
    operacao: OperacaoHistorico.Criacao,
    anterior: null,
    novo: camposApi(p),
    em: depois(criadoEm, 0, i * 3),
  }));
  historico.push(
    {
      parametro: 'chuvaModerado',
      papel: Papel.Gestor,
      operacao: OperacaoHistorico.Alteracao,
      anterior: { limiar: 25 },
      novo: { limiar: 30 },
      em: dias(20),
    },
    {
      parametro: 'umidadeModerado',
      papel: Papel.Gestor,
      operacao: OperacaoHistorico.Inativacao,
      anterior: { ativo: true },
      novo: { ativo: false },
      em: dias(15),
    },
  );

  // 1. Chuva forte que escalonou para ALTO e normalizou.
  const d1 = diaAs(26, 2);
  const a1: AlertaDemo = {
    parametro: 'chuvaAlto',
    valorLido: 31.4,
    lidaEm: d1,
    valorMaximo: 72.8,
    ultimaLeituraEm: depois(d1, 14),
    disparo: depois(d1, 0, 5),
    escalonamento: depois(d1, 3, 5),
    prorrogadoAte: null,
    encerramento: depois(d1, 16, 5),
    motivoEncerramento: MotivoEncerramento.Normalizado,
    acoesManuais: [],
    acoes: [
      {
        papel: Papel.Tecnico,
        descricao:
          'Conferiu a chuva acumulada nas fontes disponíveis e avisou a gestão de emergências.',
        em: depois(d1, 0, 17),
      },
      {
        papel: Papel.Gestor,
        descricao:
          'Acionou a Defesa Civil e as equipes de atenção básica das áreas de encosta.',
        em: depois(d1, 0, 40),
      },
      {
        papel: Papel.Gestor,
        descricao:
          'Após o escalonamento para ALTO, pediu reforço de plantão nas unidades de urgência.',
        em: depois(d1, 3, 25),
      },
      {
        papel: Papel.Comunicacao,
        descricao:
          'Publicou nota de orientação à população nos canais da Secretaria.',
        em: depois(d1, 4, 5),
      },
    ],
  };

  // 2. Calor acima do limiar, normalizado no fim da tarde.
  const d2 = diaAs(19, 12);
  const a2: AlertaDemo = {
    parametro: 'temperaturaModerado',
    valorLido: 35.6,
    lidaEm: d2,
    valorMaximo: 36.2,
    ultimaLeituraEm: depois(d2, 6),
    disparo: depois(d2, 0, 5),
    escalonamento: null,
    prorrogadoAte: null,
    encerramento: depois(d2, 7, 5),
    motivoEncerramento: MotivoEncerramento.Normalizado,
    acoesManuais: [],
    acoes: [
      {
        papel: Papel.Tecnico,
        descricao:
          'Orientou as unidades de saúde sobre o atendimento a casos de exaustão por calor.',
        em: depois(d2, 0, 45),
      },
    ],
  };

  // 3. Chuva moderada encerrada manualmente pela gestão.
  const d3 = diaAs(12, 5);
  const a3: AlertaDemo = {
    parametro: 'chuvaModerado',
    valorLido: 30.8,
    lidaEm: d3,
    valorMaximo: 44.1,
    ultimaLeituraEm: depois(d3, 9),
    disparo: depois(d3, 0, 5),
    escalonamento: null,
    prorrogadoAte: null,
    encerramento: depois(d3, 10, 5),
    motivoEncerramento: MotivoEncerramento.Manual,
    acoesManuais: [
      {
        papel: Papel.Gestor,
        tipo: TipoAcaoManual.Encerrar,
        motivo:
          'Chuva cessou e as equipes confirmaram normalidade nas áreas monitoradas.',
        prorrogadoAte: null,
        em: depois(d3, 10, 5),
      },
    ],
    acoes: [
      {
        papel: Papel.Gestor,
        descricao: 'Colocou as equipes de resposta em prontidão.',
        em: depois(d3, 0, 13),
      },
      {
        papel: Papel.Tecnico,
        descricao:
          'Levantou as unidades de saúde em áreas com histórico de alagamento.',
        em: depois(d3, 0, 55),
      },
    ],
  };

  // 4. Falso positivo, invalidado (não entra no tempo médio, RN-015 #5).
  const d4 = diaAs(8, 9);
  const a4: AlertaDemo = {
    parametro: 'chuvaModerado',
    valorLido: 33,
    lidaEm: d4,
    valorMaximo: 33,
    ultimaLeituraEm: d4,
    disparo: depois(d4, 0, 5),
    escalonamento: null,
    prorrogadoAte: null,
    encerramento: depois(d4, 0, 30),
    motivoEncerramento: MotivoEncerramento.Invalidado,
    acoesManuais: [
      {
        papel: Papel.Tecnico,
        tipo: TipoAcaoManual.Invalidar,
        motivo:
          'Leitura inconsistente com as demais fontes; falha pontual da fonte.',
        prorrogadoAte: null,
        em: depois(d4, 0, 30),
      },
    ],
    acoes: [],
  };

  // 5. Fonte parou de enviar leituras: expirou sem ação registrada.
  const d5 = diaAs(4, 13);
  const a5: AlertaDemo = {
    parametro: 'temperaturaModerado',
    valorLido: 35.1,
    lidaEm: d5,
    valorMaximo: 35.1,
    ultimaLeituraEm: d5,
    disparo: depois(d5, 0, 5),
    escalonamento: null,
    prorrogadoAte: null,
    encerramento: depois(d5, 6, 5),
    motivoEncerramento: MotivoEncerramento.Expirado,
    acoesManuais: [],
    acoes: [],
  };

  // 6. Prorrogado pela gestão por previsão de nova chuva, depois normalizado.
  const d6 = diaAs(2, 3);
  const prorrogadoEm = depois(d6, 6, 5);
  const a6: AlertaDemo = {
    parametro: 'chuvaModerado',
    valorLido: 32.5,
    lidaEm: d6,
    valorMaximo: 41,
    ultimaLeituraEm: depois(d6, 10),
    disparo: depois(d6, 0, 5),
    escalonamento: null,
    prorrogadoAte: depois(prorrogadoEm, 6),
    encerramento: depois(d6, 14, 5),
    motivoEncerramento: MotivoEncerramento.Normalizado,
    acoesManuais: [
      {
        papel: Papel.Gestor,
        tipo: TipoAcaoManual.Prorrogar,
        motivo:
          'Previsão de nova chuva forte na madrugada; manter o monitoramento.',
        prorrogadoAte: depois(prorrogadoEm, 6),
        em: prorrogadoEm,
      },
    ],
    acoes: [
      {
        papel: Papel.Tecnico,
        descricao: 'Avisou as unidades de saúde das áreas de risco.',
        em: depois(d6, 0, 30),
      },
    ],
  };

  return {
    usuarios: USUARIOS_DEMO,
    parametros: PARAMETROS,
    historico,
    alertas: [a1, a2, a3, a4, a5, a6],
    acoesAvulsas: [
      {
        papel: Papel.GestaoInstitucional,
        descricao:
          'Reunião de alinhamento com a Defesa Civil sobre o plano de contingência de chuvas.',
        em: dias(6),
      },
    ],
  };
}

// --ativo: um alerta ATIVO recente para a apresentação. A prorrogação impede
// que o job o encerre pelas leituras reais (RN-015 #6); depois dela, o job o
// encerra sozinho.
export const PRORROGACAO_DEMO_HORAS = 8;

export function alertaAtivoDemo(agora: Date): AlertaDemo {
  const disparo = new Date(agora.getTime() - 15 * MINUTO_MS);
  const lidaEm = horaCheia(disparo);
  return {
    parametro: 'chuvaModerado',
    valorLido: 34.2,
    lidaEm,
    valorMaximo: 34.2,
    ultimaLeituraEm: lidaEm,
    disparo,
    escalonamento: null,
    prorrogadoAte: new Date(agora.getTime() + PRORROGACAO_DEMO_HORAS * HORA_MS),
    encerramento: null,
    motivoEncerramento: null,
    acoesManuais: [
      {
        papel: Papel.Gestor,
        tipo: TipoAcaoManual.Prorrogar,
        motivo:
          'Demonstração: alerta fictício mantido ativo durante a apresentação.',
        prorrogadoAte: new Date(
          agora.getTime() + PRORROGACAO_DEMO_HORAS * HORA_MS,
        ),
        em: agora,
      },
    ],
    acoes: [
      {
        papel: Papel.Tecnico,
        descricao:
          'Conferiu a chuva acumulada e avisou a gestão de emergências.',
        em: new Date(agora.getTime() - 5 * MINUTO_MS),
      },
    ],
  };
}

export const FONTE_DEMO = { fonte: FONTE, estacao: ESTACAO };
