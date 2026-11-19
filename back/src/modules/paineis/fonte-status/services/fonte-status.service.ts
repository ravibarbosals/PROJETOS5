import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { FonteStatusResponseDto } from '@/modules/paineis/fonte-status/dto/fonte-status-response.dto';

// REQ-019: última coleta bem-sucedida de cada fonte (view no schema gold).
@Injectable()
export class FonteStatusService {
  constructor(private readonly dataSource: DataSource) {}

  listar(): Promise<FonteStatusResponseDto[]> {
    return this.dataSource.query<FonteStatusResponseDto[]>(
      'SELECT fonte, ultima_atualizacao FROM gold.fonte_status ORDER BY fonte',
    );
  }

  // RN-007: fontes sem coleta bem-sucedida ficam de fora, nunca "agora".
  async ultimaAtualizacaoPorFonte(): Promise<Map<string, Date>> {
    const status = await this.listar();
    return new Map(status.map((s) => [s.fonte, s.ultima_atualizacao]));
  }
}
