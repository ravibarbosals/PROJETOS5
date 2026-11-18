import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FonteStatusResponseDto } from '@/modules/paineis/dto/fonte-status-response.dto';
import { FonteStatusService } from '@/modules/paineis/services/fonte-status.service';

@ApiTags('paineis')
@ApiBearerAuth()
@Controller('fontes')
export class FonteController {
  constructor(private readonly fontes: FonteStatusService) {}

  // PER-010: every logged-in role, so no @Papeis.
  @Get('status')
  listarStatus(): Promise<FonteStatusResponseDto[]> {
    return this.fontes.listar();
  }
}
