import { Module } from '@nestjs/common';
import { FonteController } from '@/modules/paineis/fonte-status/controllers/fonte.controller';
import { IndicadorTerritorioController } from '@/modules/paineis/indicador-territorio/controllers/indicador-territorio.controller';
import { LeituraController } from '@/modules/paineis/leitura/controllers/leitura.controller';
import { MapaController } from '@/modules/paineis/mapa/controllers/mapa.controller';
import { TerritorioController } from '@/modules/paineis/territorio/controllers/territorio.controller';
import { FonteStatusService } from '@/modules/paineis/fonte-status/services/fonte-status.service';
import { IndicadorTerritorioService } from '@/modules/paineis/indicador-territorio/services/indicador-territorio.service';
import { LeituraService } from '@/modules/paineis/leitura/services/leitura.service';
import { MapaService } from '@/modules/paineis/mapa/services/mapa.service';
import { TerritorioService } from '@/modules/paineis/territorio/services/territorio.service';

// MOD-005. Só lê: o schema gold e, no mapa, os alertas ativos; não tem
// entidades próprias.
@Module({
  controllers: [
    LeituraController,
    FonteController,
    IndicadorTerritorioController,
    TerritorioController,
    MapaController,
  ],
  providers: [
    LeituraService,
    FonteStatusService,
    IndicadorTerritorioService,
    TerritorioService,
    MapaService,
  ],
  exports: [FonteStatusService, LeituraService, TerritorioService],
})
export class PaineisModule {}
