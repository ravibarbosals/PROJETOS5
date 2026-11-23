import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailService } from '@/infrastructure/email/services/email.service';
import { Usuario } from '@/modules/acesso/entities/usuario.entity';
import { AlertaAcaoManual } from '@/modules/alertas/entities/alerta-acao-manual.entity';
import { AlertaController } from '@/modules/alertas/alerta/controllers/alerta.controller';
import { ParametroAlertaController } from '@/modules/alertas/parametro-alerta/controllers/parametro-alerta.controller';
import { Alerta } from '@/modules/alertas/entities/alerta.entity';
import { ControleAvaliacaoAlerta } from '@/modules/alertas/entities/controle-avaliacao-alerta.entity';
import { ParametroAlertaHistorico } from '@/modules/alertas/entities/parametro-alerta-historico.entity';
import { ParametroAlerta } from '@/modules/alertas/entities/parametro-alerta.entity';
import { AvaliacaoAlertasJob } from '@/modules/alertas/avaliacao/jobs/avaliacao-alertas.job';
import { AlertaService } from '@/modules/alertas/alerta/services/alerta.service';
import { AvaliacaoAlertasService } from '@/modules/alertas/avaliacao/services/avaliacao-alertas.service';
import { NotificacaoAlertaService } from '@/modules/alertas/notificacao/services/notificacao-alerta.service';
import { ParametroAlertaService } from '@/modules/alertas/parametro-alerta/services/parametro-alerta.service';
import { PaineisModule } from '@/modules/paineis/paineis.module';

// MOD-002.
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Alerta,
      AlertaAcaoManual,
      ControleAvaliacaoAlerta,
      ParametroAlerta,
      ParametroAlertaHistorico,
      Usuario,
    ]),
    PaineisModule,
  ],
  controllers: [AlertaController, ParametroAlertaController],
  providers: [
    AlertaService,
    ParametroAlertaService,
    AvaliacaoAlertasService,
    AvaliacaoAlertasJob,
    EmailService,
    NotificacaoAlertaService,
  ],
})
export class AlertasModule {}
