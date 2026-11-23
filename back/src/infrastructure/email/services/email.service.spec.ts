import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { createTransport } from 'nodemailer';
import { EnvironmentVariables } from '@/core/config/env.validation';
import { EmailService } from '@/infrastructure/email/services/email.service';

jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));

const createTransportMock = jest.mocked(createTransport);

function setup(valores: Partial<EnvironmentVariables>) {
  const sendMail = jest.fn().mockResolvedValue({});
  createTransportMock.mockReturnValue({ sendMail } as never);
  const config = {
    get: (chave: keyof EnvironmentVariables) =>
      ({
        SMTP_PORT: 587,
        SMTP_FROM: 'O Vigia <alertas@vigia.local>',
        ...valores,
      })[chave],
  };
  const servico = new EmailService(
    config as unknown as ConfigService<EnvironmentVariables, true>,
  );
  return { servico, sendMail };
}

const email = { para: 'gestor@exemplo.gov.br', assunto: 'A', texto: 'T' };

// DEC-037.
describe('EmailService', () => {
  beforeEach(() => {
    createTransportMock.mockReset();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('is off without SMTP_HOST and sends nothing', async () => {
    const { servico, sendMail } = setup({});

    await servico.enviar(email);

    expect(servico.habilitado).toBe(false);
    expect(createTransportMock).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('sends through the configured SMTP from SMTP_FROM, with timeouts', async () => {
    const { servico, sendMail } = setup({
      SMTP_HOST: 'mailpit',
      SMTP_PORT: 1025,
    });

    await servico.enviar(email);

    expect(servico.habilitado).toBe(true);
    expect(createTransportMock).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'mailpit',
        port: 1025,
        secure: false,
        auth: undefined,
        connectionTimeout: 10_000,
        socketTimeout: 10_000,
      }),
    );
    expect(sendMail).toHaveBeenCalledWith({
      from: 'O Vigia <alertas@vigia.local>',
      to: 'gestor@exemplo.gov.br',
      subject: 'A',
      text: 'T',
    });
  });

  it('uses TLS on 465 and the credentials when given', () => {
    setup({
      SMTP_HOST: 'smtp.exemplo.gov.br',
      SMTP_PORT: 465,
      SMTP_USER: 'vigia',
      SMTP_PASS: 'segredo',
    });

    expect(createTransportMock).toHaveBeenCalledWith(
      expect.objectContaining({
        secure: true,
        auth: { user: 'vigia', pass: 'segredo' },
      }),
    );
  });
});
