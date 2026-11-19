import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Alerta } from '@/modules/alertas/entities/alerta.entity';
import { AcaoController } from '@/modules/rastreio-operacional/acao/controllers/acao.controller';
import { IndicadorController } from '@/modules/rastreio-operacional/tempo-acionamento/controllers/indicador.controller';
import { LinhaDoTempoController } from '@/modules/rastreio-operacional/linha-do-tempo/controllers/linha-do-tempo.controller';
import { Acao } from '@/modules/rastreio-operacional/entities/acao.entity';
import { AcaoService } from '@/modules/rastreio-operacional/acao/services/acao.service';
import { LinhaDoTempoService } from '@/modules/rastreio-operacional/linha-do-tempo/services/linha-do-tempo.service';
import { TempoAcionamentoService } from '@/modules/rastreio-operacional/tempo-acionamento/services/tempo-acionamento.service';

// MOD-003.
@Module({
  imports: [TypeOrmModule.forFeature([Acao, Alerta])],
  controllers: [AcaoController, IndicadorController, LinhaDoTempoController],
  providers: [AcaoService, LinhaDoTempoService, TempoAcionamentoService],
})
export class RastreioOperacionalModule {}
