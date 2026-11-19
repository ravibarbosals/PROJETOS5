import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiPaginationQuery, Paginate, Paginated } from 'nestjs-paginate';
import type { PaginateQuery } from 'nestjs-paginate';
import { Papeis } from '@/modules/acesso/decorators/papeis.decorator';
import { UsuarioAtual } from '@/modules/acesso/decorators/usuario-atual.decorator';
import { Usuario } from '@/modules/acesso/entities/usuario.entity';
import { Papel } from '@/modules/acesso/enums/papel.enum';
import {
  MotivoAlertaDto,
  ProrrogarAlertaDto,
} from '@/modules/alertas/alerta/dto/acao-manual-alerta.dto';
import { AlertaResponseDto } from '@/modules/alertas/alerta/dto/alerta-response.dto';
import { Alerta } from '@/modules/alertas/entities/alerta.entity';
import { TipoAcaoManual } from '@/modules/alertas/enums/tipo-acao-manual.enum';
import {
  ALERTA_PAGINATE_CONFIG,
  AlertaService,
} from '@/modules/alertas/alerta/services/alerta.service';
import { FonteStatusService } from '@/modules/paineis/fonte-status/services/fonte-status.service';

// :id inválido dá 422, como qualquer outra entrada inválida (DEC-010).
const IdPipe = new ParseIntPipe({
  errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
});

@ApiTags('alertas')
@ApiBearerAuth()
@Controller('alertas')
export class AlertaController {
  constructor(
    private readonly alertas: AlertaService,
    private readonly fontes: FonteStatusService,
  ) {}

  // PER-006. COM pendente da DUV-036, implementado como negado.
  @Get()
  @Papeis(Papel.Tecnico, Papel.Gestor, Papel.GestaoInstitucional)
  @ApiPaginationQuery(ALERTA_PAGINATE_CONFIG)
  async listar(
    @Paginate() query: PaginateQuery,
  ): Promise<Paginated<AlertaResponseDto>> {
    const [pagina, atualizacoes] = await Promise.all([
      this.alertas.listar(query),
      this.fontes.ultimaAtualizacaoPorFonte(),
    ]);
    return {
      ...pagina,
      data: pagina.data.map((alerta) =>
        AlertaResponseDto.from(alerta, atualizacoes.get(alerta.fonte) ?? null),
      ),
    } as Paginated<AlertaResponseDto>;
  }

  // PER-014. RN-015 #4.
  @Post(':id/encerrar')
  @HttpCode(HttpStatus.OK)
  @Papeis(Papel.Tecnico, Papel.Gestor)
  @ApiNotFoundResponse({ description: 'Alerta não encontrado' })
  @ApiConflictResponse({ description: 'ALERTA_NAO_ATIVO' })
  async encerrar(
    @Param('id', IdPipe) id: number,
    @Body() dto: MotivoAlertaDto,
    @UsuarioAtual() usuario: Usuario,
  ): Promise<AlertaResponseDto> {
    return this.responder(
      await this.alertas.agir(
        id,
        { tipo: TipoAcaoManual.Encerrar, motivo: dto.motivo },
        usuario,
      ),
    );
  }

  // PER-015: só o coordenador invalida. RN-015 #5.
  @Post(':id/invalidar')
  @HttpCode(HttpStatus.OK)
  @Papeis(Papel.Gestor)
  @ApiNotFoundResponse({ description: 'Alerta não encontrado' })
  @ApiConflictResponse({ description: 'ALERTA_NAO_ATIVO' })
  async invalidar(
    @Param('id', IdPipe) id: number,
    @Body() dto: MotivoAlertaDto,
    @UsuarioAtual() usuario: Usuario,
  ): Promise<AlertaResponseDto> {
    return this.responder(
      await this.alertas.agir(
        id,
        { tipo: TipoAcaoManual.Invalidar, motivo: dto.motivo },
        usuario,
      ),
    );
  }

  // PER-014. RN-015 #6.
  @Post(':id/prorrogar')
  @HttpCode(HttpStatus.OK)
  @Papeis(Papel.Tecnico, Papel.Gestor)
  @ApiNotFoundResponse({ description: 'Alerta não encontrado' })
  @ApiConflictResponse({ description: 'ALERTA_NAO_ATIVO' })
  async prorrogar(
    @Param('id', IdPipe) id: number,
    @Body() dto: ProrrogarAlertaDto,
    @UsuarioAtual() usuario: Usuario,
  ): Promise<AlertaResponseDto> {
    return this.responder(
      await this.alertas.agir(
        id,
        {
          tipo: TipoAcaoManual.Prorrogar,
          motivo: dto.motivo,
          horas: dto.horas,
        },
        usuario,
      ),
    );
  }

  private async responder(alerta: Alerta): Promise<AlertaResponseDto> {
    const atualizacoes = await this.fontes.ultimaAtualizacaoPorFonte();
    return AlertaResponseDto.from(
      alerta,
      atualizacoes.get(alerta.fonte) ?? null,
    );
  }
}
