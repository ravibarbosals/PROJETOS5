import {
  type AlertaDemo,
  PRORROGACAO_DEMO_HORAS,
  alertaAtivoDemo,
  cenarioDemo,
} from '@/infrastructure/database/seed-demo/cenario-demo';
import { Papel } from '@/modules/acesso/enums/papel.enum';
import {
  MOTIVO_MIN,
  PRORROGACAO_HORAS_MAX,
} from '@/modules/alertas/alerta/domain/acao-manual';
import { MotivoEncerramento } from '@/modules/alertas/enums/motivo-encerramento.enum';
import { TipoAcaoManual } from '@/modules/alertas/enums/tipo-acao-manual.enum';

const AGORA = new Date('2026-11-20T15:37:00Z');
const cenario = cenarioDemo(AGORA);
const HORA_MS = 3_600_000;

// Cada alerta precisa ser um estado que o job e as ações manuais produziriam
// (DEC-029, RN-012, RN-015), senão a demonstração mostra algo impossível.
function conferirAlerta(a: AlertaDemo) {
  expect(a.lidaEm.getTime()).toBeLessThanOrEqual(a.disparo.getTime());
  expect(a.ultimaLeituraEm.getTime()).toBeGreaterThanOrEqual(
    a.lidaEm.getTime(),
  );
  expect(a.valorMaximo).toBeGreaterThanOrEqual(a.valorLido);
  for (const acao of a.acoes) {
    expect(acao.em.getTime()).toBeGreaterThan(a.disparo.getTime());
    expect(acao.descricao.length).toBeLessThanOrEqual(2000);
  }
  for (const m of a.acoesManuais) {
    expect(m.motivo.trim().length).toBeGreaterThanOrEqual(MOTIVO_MIN);
    expect(m.em.getTime()).toBeGreaterThan(a.disparo.getTime());
    expect(m.prorrogadoAte !== null).toBe(m.tipo === TipoAcaoManual.Prorrogar);
    if (m.prorrogadoAte) {
      expect(m.prorrogadoAte.getTime() - m.em.getTime()).toBeLessThanOrEqual(
        PRORROGACAO_HORAS_MAX * HORA_MS,
      );
      expect(a.prorrogadoAte).toEqual(m.prorrogadoAte);
    }
  }
}

describe('cenarioDemo (TASK-050)', () => {
  it('has one demo user per profile, without ADM (seed:admin creates it)', () => {
    expect(cenario.usuarios.map((u) => u.papel).sort()).toEqual(
      [
        Papel.Comunicacao,
        Papel.GestaoInstitucional,
        Papel.Gestor,
        Papel.Tecnico,
      ].sort(),
    );
    for (const u of cenario.usuarios) {
      expect(u.email).toMatch(/@demo\.vigia\.local$/);
    }
  });

  it('uses the real gold variables and keeps limiar_saida below limiar', () => {
    for (const p of cenario.parametros) {
      expect(['precipitacao_mm', 'temperatura_c', 'umidade_pct']).toContain(
        p.variavel,
      );
      expect(p.territorio).toBe('Recife');
      expect(p.limiarSaida).toBeLessThan(p.limiar);
      expect(p.janelaHoras).toBeGreaterThanOrEqual(1);
      expect(p.janelaHoras).toBeLessThanOrEqual(72);
    }
  });

  it('keeps everything in the past, the latest closure before now', () => {
    for (const a of cenario.alertas) {
      expect(a.encerramento!.getTime()).toBeLessThan(AGORA.getTime());
    }
    for (const h of cenario.historico) {
      expect(h.em.getTime()).toBeLessThan(AGORA.getTime());
    }
  });

  it('builds only closed alerts that the job and manual actions could produce', () => {
    for (const a of cenario.alertas) {
      conferirAlerta(a);
      expect(a.encerramento!.getTime()).toBeGreaterThan(a.disparo.getTime());
    }
  });

  it('covers every closure reason (RN-015)', () => {
    expect(new Set(cenario.alertas.map((a) => a.motivoEncerramento))).toEqual(
      new Set(Object.values(MotivoEncerramento)),
    );
  });

  it('never has two alerts of the same variable open at the same time (RN-013)', () => {
    const porVariavel = new Map<string, AlertaDemo[]>();
    for (const a of cenario.alertas) {
      const variavel = a.parametro.startsWith('chuva') ? 'chuva' : a.parametro;
      porVariavel.set(variavel, [...(porVariavel.get(variavel) ?? []), a]);
    }
    for (const alertas of porVariavel.values()) {
      const ordenados = [...alertas].sort(
        (x, y) => x.disparo.getTime() - y.disparo.getTime(),
      );
      for (let i = 1; i < ordenados.length; i++) {
        expect(ordenados[i].disparo.getTime()).toBeGreaterThan(
          ordenados[i - 1].encerramento!.getTime(),
        );
      }
    }
  });

  it('leaves the invalidated and the expired alerts without actions', () => {
    const semAcao = cenario.alertas.filter((a) => a.acoes.length === 0);
    expect(semAcao.map((a) => a.motivoEncerramento).sort()).toEqual(
      [MotivoEncerramento.Expirado, MotivoEncerramento.Invalidado].sort(),
    );
  });
});

describe('alertaAtivoDemo (--ativo)', () => {
  const ativo = alertaAtivoDemo(AGORA);

  it('is active, recent and extended so the job keeps it (RN-015 #6)', () => {
    conferirAlerta(ativo);
    expect(ativo.encerramento).toBeNull();
    expect(ativo.motivoEncerramento).toBeNull();
    expect(ativo.disparo.getTime()).toBeLessThan(AGORA.getTime());
    expect(ativo.prorrogadoAte).toEqual(
      new Date(AGORA.getTime() + PRORROGACAO_DEMO_HORAS * HORA_MS),
    );
  });
});
