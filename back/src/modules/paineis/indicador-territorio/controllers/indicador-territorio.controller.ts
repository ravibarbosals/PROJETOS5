import { Controller, Get, Header, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IndicadorResponseDto } from '@/modules/paineis/indicador-territorio/dto/indicador-response.dto';
import { IndicadoresQueryDto } from '@/modules/paineis/indicador-territorio/dto/indicadores-query.dto';
import { IndicadorTerritorioService } from '@/modules/paineis/indicador-territorio/services/indicador-territorio.service';

@ApiTags('paineis')
@ApiBearerAuth()
@Controller('indicadores')
export class IndicadorTerritorioController {
  constructor(private readonly indicadores: IndicadorTerritorioService) {}

  // PER-010: todo papel logado, por isso sem @Papeis. Dado semanal: o
  // navegador pode reusar por 5 minutos; "private" porque exige login.
  @Get()
  @Header('Cache-Control', 'private, max-age=300')
  listar(
    @Query() filtros: IndicadoresQueryDto,
  ): Promise<IndicadorResponseDto[]> {
    return this.indicadores.listar(filtros);
  }
}
