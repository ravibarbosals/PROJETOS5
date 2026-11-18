import { Module } from '@nestjs/common';
import { FonteController } from '@/modules/paineis/controllers/fonte.controller';
import { LeituraController } from '@/modules/paineis/controllers/leitura.controller';
import { FonteStatusService } from '@/modules/paineis/services/fonte-status.service';
import { LeituraService } from '@/modules/paineis/services/leitura.service';

// MOD-005. Only reads the gold schema; no entities of its own.
@Module({
  controllers: [LeituraController, FonteController],
  providers: [LeituraService, FonteStatusService],
})
export class PaineisModule {}
