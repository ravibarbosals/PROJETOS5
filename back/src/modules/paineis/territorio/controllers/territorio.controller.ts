import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TerritorioResponseDto } from '@/modules/paineis/territorio/dto/territorio-response.dto';
import { TerritorioService } from '@/modules/paineis/territorio/services/territorio.service';

@ApiTags('paineis')
@ApiBearerAuth()
@Controller('territorios')
export class TerritorioController {
  constructor(private readonly territorios: TerritorioService) {}

  // PER-010: todo papel logado, por isso sem @Papeis.
  @Get()
  listar(): Promise<TerritorioResponseDto[]> {
    return this.territorios.listar();
  }
}
