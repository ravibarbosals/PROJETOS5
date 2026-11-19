import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { LeituraResponseDto } from '@/modules/paineis/dto/leitura-response.dto';
import { LeiturasQueryDto } from '@/modules/paineis/dto/leituras-query.dto';
import { LeituraService } from '@/modules/paineis/services/leitura.service';

@ApiTags('paineis')
@ApiBearerAuth()
@Controller('leituras')
export class LeituraController {
  constructor(private readonly leituras: LeituraService) {}

  // PER-010: todo papel logado, por isso sem @Papeis.
  @Get()
  listar(@Query() filtros: LeiturasQueryDto): Promise<LeituraResponseDto[]> {
    return this.leituras.listar(filtros);
  }
}
