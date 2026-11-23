import { NivelAlerta } from '@/modules/alertas/enums/nivel-alerta.enum';

// DEC-037: o e-mail sai no disparo e no escalonamento (MODERADO → ALTO).
export enum EventoAlerta {
  Disparo = 'DISPARO',
  Escalonamento = 'ESCALONAMENTO',
}

export interface AlertaDoEmail {
  nivel: NivelAlerta;
  variavel: string;
  territorio: string;
  limiar: number;
  valorLido: number;
  valorMaximo: number;
  lidaEm: Date;
  fonte: string;
  estacao: string;
  dthrDisparo: Date;
  dthrEscalonamento: Date | null;
}

// Variáveis de gold.leitura_climatica (DEC-024).
const VARIAVEIS: Record<string, { nome: string; unidade: string }> = {
  precipitacao_mm: { nome: 'Precipitação', unidade: 'mm' },
  temperatura_c: { nome: 'Temperatura', unidade: '°C' },
  umidade_pct: { nome: 'Umidade', unidade: '%' },
  pressao_hpa: { nome: 'Pressão', unidade: 'hPa' },
};

const dataHora = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Recife',
  dateStyle: 'short',
  timeStyle: 'short',
});
const numero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

export function montarEmailDoAlerta(
  alerta: AlertaDoEmail,
  evento: EventoAlerta,
): { assunto: string; texto: string } {
  const variavel = VARIAVEIS[alerta.variavel] ?? {
    nome: alerta.variavel,
    unidade: '',
  };
  const valor = (v: number) =>
    `${numero.format(v)}${variavel.unidade ? ` ${variavel.unidade}` : ''}`;
  const onde = `${variavel.nome} em ${alerta.territorio}`;

  const escalonadoEm =
    evento === EventoAlerta.Escalonamento ? alerta.dthrEscalonamento : null;
  const assunto = escalonadoEm
    ? `[O Vigia] Alerta escalonado para ${alerta.nivel}: ${onde}`
    : `[O Vigia] Alerta ${alerta.nivel}: ${onde}`;
  const abertura = escalonadoEm
    ? `O alerta de ${onde} subiu para ${alerta.nivel} em ${dataHora.format(escalonadoEm)} (horário do Recife).`
    : `Alerta ${alerta.nivel} disparado em ${dataHora.format(alerta.dthrDisparo)} (horário do Recife).`;

  const linhas = [
    abertura,
    '',
    `Território: ${alerta.territorio}`,
    `Variável: ${variavel.nome}`,
    `Limiar do nível ${alerta.nivel}: ${valor(alerta.limiar)}`,
    `Valor que disparou: ${valor(alerta.valorLido)}, lido em ${dataHora.format(alerta.lidaEm)}`,
    ...(escalonadoEm
      ? [`Valor máximo até agora: ${valor(alerta.valorMaximo)}`]
      : []),
    `Fonte: ${alerta.fonte} (estação ${alerta.estacao})`,
    '',
    'Acompanhe o alerta e registre a resposta na EST-02 do O Vigia.',
    '',
    'Mensagem automática, enviada a todos os usuários ativos do O Vigia.',
  ];
  return { assunto, texto: linhas.join('\n') };
}
