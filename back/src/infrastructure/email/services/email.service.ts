import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import { EnvironmentVariables } from '@/core/config/env.validation';

export interface Email {
  para: string;
  assunto: string;
  texto: string;
}

// Um SMTP parado não pode prender o envio para sempre (DEC-037).
const TEMPO_LIMITE_MS = 10_000;

// DEC-037: envio por SMTP genérico (Mailpit no compose; em produção, só o
// .env muda). Sem SMTP_HOST, não envia nada.
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporte: Transporter | null;
  private readonly remetente: string;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    const host = config.get('SMTP_HOST', { infer: true });
    const porta = config.get('SMTP_PORT', { infer: true });
    const usuario = config.get('SMTP_USER', { infer: true });
    this.remetente = config.get('SMTP_FROM', { infer: true });
    this.transporte = host
      ? createTransport({
          host,
          port: porta,
          // 465 é TLS direto; nas outras portas o nodemailer usa STARTTLS se o
          // servidor oferecer.
          secure: porta === 465,
          auth: usuario
            ? { user: usuario, pass: config.get('SMTP_PASS', { infer: true }) }
            : undefined,
          connectionTimeout: TEMPO_LIMITE_MS,
          greetingTimeout: TEMPO_LIMITE_MS,
          socketTimeout: TEMPO_LIMITE_MS,
        })
      : null;
  }

  get habilitado(): boolean {
    return this.transporte !== null;
  }

  // Rejeita se o SMTP recusar ou não responder; quem chama decide o que fazer.
  async enviar(email: Email): Promise<void> {
    if (!this.transporte) {
      this.logger.warn(`SMTP_HOST não definido; e-mail não enviado`);
      return;
    }
    await this.transporte.sendMail({
      from: this.remetente,
      to: email.para,
      subject: email.assunto,
      text: email.texto,
    });
  }
}
