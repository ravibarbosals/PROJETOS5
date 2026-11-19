import { criarPool } from './db.js';
import { coletar, tratar } from './pipeline.js';

const INTERVALO_MS = Number(process.env.INTERVALO_MINUTOS ?? 60) * 60_000;

const pool = criarPool();
let proximo: NodeJS.Timeout | undefined;
let parando = false;

async function ciclo(): Promise<void> {
  console.log(`ciclo iniciado em ${new Date().toISOString()}`);
  try {
    await coletar(pool);
    await tratar(pool);
  } catch (erro) {
    // Um ciclo com falha (banco fora do ar etc.) não pode impedir os próximos
    console.error(`ciclo falhou: ${String(erro)}`);
  }
  if (!parando) {
    proximo = setTimeout(() => void ciclo(), INTERVALO_MS);
  }
}

async function parar(): Promise<void> {
  parando = true;
  clearTimeout(proximo);
  await pool.end();
  console.log('agendador encerrado');
}

process.once('SIGINT', () => void parar());
process.once('SIGTERM', () => void parar());

void ciclo();