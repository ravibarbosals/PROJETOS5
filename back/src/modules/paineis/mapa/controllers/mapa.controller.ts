import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Papeis } from '@/modules/acesso/decorators/papeis.decorator';
import { Papel } from '@/modules/acesso/enums/papel.enum';
import { MapaResponseDto } from '@/modules/paineis/mapa/dto/mapa-response.dto';
import { MapaService } from '@/modules/paineis/mapa/services/mapa.service';

@ApiTags('paineis')
@ApiBearerAuth()
@Controller('mapa')
export class MapaController {
  constructor(private readonly mapa: MapaService) {}

  // PER-011: a Comunicação não vê o mapa; o ADM passa pelo guard.
  @Get()
  @Papeis(Papel.Tecnico, Papel.Gestor, Papel.GestaoInstitucional)
  montar(): Promise<MapaResponseDto> {
    return this.mapa.montar();
  }
}
