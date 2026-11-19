import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlertaAcaoManual } from '@/modules/alertas/entities/alerta-acao-manual.entity';
import { AlertaController } from '@/modules/alertas/controllers/alerta.controller';
import { ParametroAlertaController } from '@/modules/alertas/controllers/parametro-alerta.controller';
import { Alerta } from '@/modules/alertas/entities/alerta.entity';
import { ControleAvaliacaoAlerta } from '@/modules/alertas/entities/controle-avaliacao-alerta.entity';
import { ParametroAlertaHistorico } from '@/modules/alertas/entities/parametro-alerta-historico.entity';
import { ParametroAlerta } from '@/modules/alertas/entities/parametro-alerta.entity';
import { AvaliacaoAlertasJob } from '@/modules/alertas/jobs/avaliacao-alertas.job';
import { AlertaService } from '@/modules/alertas/services/alerta.service';
import { AvaliacaoAlertasService } from '@/modules/alertas/services/avaliacao-alertas.service';
import { ParametroAlertaService } from '@/modules/alertas/services/parametro-alerta.service';
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
    ]),
    PaineisModule,
  ],
  controllers: [AlertaController, ParametroAlertaController],
  providers: [
    AlertaService,
    ParametroAlertaService,
    AvaliacaoAlertasService,
    AvaliacaoAlertasJob,
  ],
})
export class AlertasModule {}
