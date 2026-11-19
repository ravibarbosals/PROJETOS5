import { Module } from '@nestjs/common';
import { FonteController } from '@/modules/paineis/fonte-status/controllers/fonte.controller';
import { IndicadorTerritorioController } from '@/modules/paineis/indicador-territorio/controllers/indicador-territorio.controller';
import { LeituraController } from '@/modules/paineis/leitura/controllers/leitura.controller';
import { FonteStatusService } from '@/modules/paineis/fonte-status/services/fonte-status.service';
import { IndicadorTerritorioService } from '@/modules/paineis/indicador-territorio/services/indicador-territorio.service';
import { LeituraService } from '@/modules/paineis/leitura/services/leitura.service';

// MOD-005. Só lê o schema gold; não tem entidades próprias.
@Module({
  controllers: [
    LeituraController,
    FonteController,
    IndicadorTerritorioController,
  ],
  providers: [LeituraService, FonteStatusService, IndicadorTerritorioService],
  exports: [FonteStatusService],
})
export class PaineisModule {}
