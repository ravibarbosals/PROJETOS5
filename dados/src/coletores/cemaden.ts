import type { Coleta } from './openmeteo.js';

export const FONTE_CEMADEN = 'cemaden';

// Plataforma de Entrega de Dados do Cemaden (DEC-036, DEC-045). O login gera
// um JWT de 4 h, pedido a cada coleta. O token carrega a senha: não vai para
// log nem para o bronze.
const URL_TOKEN = 'https://sgaa.cemaden.gov.br/SGAA/rest/controle-token/tokens';

// Últimas 3 h dos pluviômetros (rede 11) do Recife (IBGE 2611606), horários
// em UTC. Com o ciclo de 1 h, as janelas se sobrepõem e o upsert não duplica.
export const URL_CEMADEN =
  'https://sws.cemaden.gov.br/PED/rest/pcds/pcds-dados-recentes?' +
  new URLSearchParams({
    rede: '11',
    uf: 'PE',
    codibge: '2611606',
    formato: 'JSON',
  }).toString();

// A resposta traz outros sensores das estações; o bronze guarda só o do
// pluviômetro.
export const SENSOR_PLUVIOMETRO = 10;

const TEMPO_LIMITE_MS = 30_000;

export function credenciaisCemaden(): { email: string; senha: string } | null {
  const email = process.env.CEMADEN_EMAIL;
  const senha = process.env.CEMADEN_SENHA;
  return email && senha ? { email, senha } : null;
}

function falha(statusHttp: number, erro: string): Coleta {
  return { fonte: FONTE_CEMADEN, url: URL_CEMADEN, statusHttp, payload: { erro } };
}

async function pedirToken(email: string, senha: string): Promise<string | Coleta> {
  const resposta = await fetch(URL_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: senha }),
    signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
  });
  // O corpo da resposta não é gravado: pode ecoar dados do login
  if (!resposta.ok) return falha(resposta.status, `login: HTTP ${resposta.status}`);
  const corpo: unknown = await resposta.json();
  const token =
    typeof corpo === 'object' && corpo !== null && 'token' in corpo
      ? corpo.token
      : undefined;
  return typeof token === 'string' ? token : falha(0, 'login: resposta sem token');
}

export async function coletarCemaden(credenciais: {
  email: string;
  senha: string;
}): Promise<Coleta> {
  try {
    const token = await pedirToken(credenciais.email, credenciais.senha);
    if (typeof token !== 'string') return token;

    const resposta = await fetch(URL_CEMADEN, {
      headers: { token },
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
    });
    if (!resposta.ok) {
      return falha(resposta.status, await resposta.text());
    }
    const corpo: unknown = await resposta.json();
    const payload = Array.isArray(corpo)
      ? corpo.filter(
          (l: unknown) =>
            typeof l === 'object' &&
            l !== null &&
            'id_sensor' in l &&
            l.id_sensor === SENSOR_PLUVIOMETRO,
        )
      : corpo;
    return { fonte: FONTE_CEMADEN, url: URL_CEMADEN, statusHttp: resposta.status, payload };
  } catch (erro) {
    // Falha de rede ou timeout: sem status HTTP, registrado como 0
    return falha(0, String(erro));
  }
}
