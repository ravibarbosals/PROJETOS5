import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { EmailService } from '@/infrastructure/email/services/email.service';
import { Usuario } from '@/modules/acesso/entities/usuario.entity';
import { Alerta } from '@/modules/alertas/entities/alerta.entity';
import {
  EventoAlerta,
  montarEmailDoAlerta,
} from '@/modules/alertas/notificacao/domain/email-do-alerta';

export interface AvisoDeAlerta {
  idAlerta: number;
  evento: EventoAlerta;
}

// PR-027, PR-029, DEC-037: cada alerta disparado ou escalonado vai por e-mail
// a todos os usuários ativos, um e-mail por pessoa (ninguém vê o endereço dos
// outros). Chamado depois de o alerta estar gravado; nunca rejeita: uma falha
// fica no log e não volta para o job.
@Injectable()
export class NotificacaoAlertaService {
  private readonly logger = new Logger(NotificacaoAlertaService.name);

  constructor(
    private readonly email: EmailService,
    @InjectRepository(Alerta)
    private readonly alertas: Repository<Alerta>,
    @InjectRepository(Usuario)
    private readonly usuarios: Repository<Usuario>,
  ) {}

  async notificar(avisos: AvisoDeAlerta[]): Promise<void> {
    if (avisos.length === 0) return;
    if (!this.email.habilitado) {
      this.logger.warn(
        `SMTP_HOST não definido; ${avisos.length} alerta(s) sem e-mail`,
      );
      return;
    }

    try {
      const alertas = await this.alertas.findBy({
        id: In(avisos.map((a) => a.idAlerta)),
      });
      const destinatarios = await this.usuarios.find({
        select: { email: true },
        where: { ativo: true },
        order: { id: 'ASC' },
      });

      for (const aviso of avisos) {
        const alerta = alertas.find((a) => a.id === aviso.idAlerta);
        if (!alerta) continue;
        const { assunto, texto } = montarEmailDoAlerta(alerta, aviso.evento);
        let enviados = 0;
        for (const { email } of destinatarios) {
          try {
            await this.email.enviar({ para: email, assunto, texto });
            enviados += 1;
          } catch (erro) {
            // Um endereço recusado não impede os outros.
            this.logger.error(
              `Falha no e-mail do alerta ${alerta.id}`,
              (erro as Error).message,
            );
          }
        }
        this.logger.log(
          `Alerta ${alerta.id} (${aviso.evento}): ${enviados} de ${destinatarios.length} e-mails enviados`,
        );
      }
    } catch (erro) {
      this.logger.error(
        'Falha ao preparar os e-mails de alerta',
        erro as Error,
      );
    }
  }
}
