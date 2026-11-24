import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Papeis } from '@/modules/acesso/decorators/papeis.decorator';
import { Papel } from '@/modules/acesso/enums/papel.enum';
import { DecisoesPendentesResponseDto } from '@/modules/rastreio-operacional/decisoes-pendentes/dto/decisoes-pendentes-response.dto';
import { DecisoesPendentesService } from '@/modules/rastreio-operacional/decisoes-pendentes/services/decisoes-pendentes.service';

@ApiTags('indicadores')
@ApiBearerAuth()
@Controller('indicadores')
export class DecisoesPendentesController {
  constructor(private readonly decisoesPendentes: DecisoesPendentesService) {}

  // PER-016 (EST-03). PR-033.
  @Get('decisoes-pendentes')
  @Papeis(Papel.GestaoInstitucional)
  listar(): Promise<DecisoesPendentesResponseDto> {
    return this.decisoesPendentes.listar();
  }
}
