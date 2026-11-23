import { Logger } from '@nestjs/common';
import type { Repository } from 'typeorm';
import type {
  Email,
  EmailService,
} from '@/infrastructure/email/services/email.service';
import type { Usuario } from '@/modules/acesso/entities/usuario.entity';
import type { Alerta } from '@/modules/alertas/entities/alerta.entity';
import { NivelAlerta } from '@/modules/alertas/enums/nivel-alerta.enum';
import { EventoAlerta } from '@/modules/alertas/notificacao/domain/email-do-alerta';
import { NotificacaoAlertaService } from '@/modules/alertas/notificacao/services/notificacao-alerta.service';

const alerta = {
  id: 7,
  nivel: NivelAlerta.Alto,
  variavel: 'temperatura_c',
  territorio: 'RPA 6 - Sul',
  limiar: 20,
  valorLido: 31,
  valorMaximo: 31,
  lidaEm: new Date('2026-11-21T12:00:00Z'),
  fonte: 'openmeteo',
  estacao: 'rpa6',
  dthrDisparo: new Date('2026-11-21T12:10:00Z'),
  dthrEscalonamento: null,
} as Alerta;

function setup({ habilitado = true } = {}) {
  const email = {
    habilitado,
    enviar: jest.fn<Promise<void>, [Email]>().mockResolvedValue(undefined),
  };
  const alertas = { findBy: jest.fn().mockResolvedValue([alerta]) };
  const usuarios = {
    find: jest
      .fn()
      .mockResolvedValue([
        { email: 'gestor@exemplo.gov.br' },
        { email: 'tecnico@exemplo.gov.br' },
      ]),
  };
  const servico = new NotificacaoAlertaService(
    email as unknown as EmailService,
    alertas as unknown as Repository<Alerta>,
    usuarios as unknown as Repository<Usuario>,
  );
  return { servico, email, alertas, usuarios };
}

const disparo = [{ idAlerta: 7, evento: EventoAlerta.Disparo }];

// PR-027, PR-029, DEC-037.
describe('NotificacaoAlertaService', () => {
  let erro: jest.SpyInstance;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    erro = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sends one e-mail per active user (PR-029)', async () => {
    const { servico, email, usuarios } = setup();

    await servico.notificar(disparo);

    expect(usuarios.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ativo: true } }),
    );
    expect(email.enviar.mock.calls.map(([e]) => e.para)).toEqual([
      'gestor@exemplo.gov.br',
      'tecnico@exemplo.gov.br',
    ]);
    expect(email.enviar.mock.calls[0][0].assunto).toBe(
      '[O Vigia] Alerta ALTO: Temperatura em RPA 6 - Sul',
    );
  });

  it('keeps sending to the others when one address fails', async () => {
    const { servico, email } = setup();
    email.enviar.mockRejectedValueOnce(new Error('550 recusado'));

    await servico.notificar(disparo);

    expect(email.enviar).toHaveBeenCalledTimes(2);
    expect(erro).toHaveBeenCalled();
  });

  it('never rejects, even when the database fails (DEC-037)', async () => {
    const { servico, alertas, email } = setup();
    alertas.findBy.mockRejectedValue(new Error('banco fora do ar'));

    await expect(servico.notificar(disparo)).resolves.toBeUndefined();
    expect(email.enviar).not.toHaveBeenCalled();
    expect(erro).toHaveBeenCalled();
  });

  it('does not touch the database when there is nothing to send or no SMTP', async () => {
    const vazio = setup();
    await vazio.servico.notificar([]);
    expect(vazio.alertas.findBy).not.toHaveBeenCalled();

    const semSmtp = setup({ habilitado: false });
    await semSmtp.servico.notificar(disparo);
    expect(semSmtp.alertas.findBy).not.toHaveBeenCalled();
    expect(semSmtp.email.enviar).not.toHaveBeenCalled();
  });
});
