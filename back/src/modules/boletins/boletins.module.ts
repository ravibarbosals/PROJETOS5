import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BoletimController } from '@/modules/boletins/controllers/boletim.controller';
import { BoletimService } from '@/modules/boletins/services/boletim.service';
import { PaineisModule } from '@/modules/paineis/paineis.module';
import { Acao } from '@/modules/rastreio-operacional/entities/acao.entity';

// MOD-004.
@Module({
  imports: [TypeOrmModule.forFeature([Acao]), PaineisModule],
  controllers: [BoletimController],
  providers: [BoletimService],
})
export class BoletinsModule {}
