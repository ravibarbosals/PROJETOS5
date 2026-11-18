import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { FonteStatusResponseDto } from '@/modules/paineis/dto/fonte-status-response.dto';

// REQ-019: last successful collection of each source (view in the gold schema).
@Injectable()
export class FonteStatusService {
  constructor(private readonly dataSource: DataSource) {}

  listar(): Promise<FonteStatusResponseDto[]> {
    return this.dataSource.query<FonteStatusResponseDto[]>(
      'SELECT fonte, ultima_atualizacao FROM gold.fonte_status ORDER BY fonte',
    );
  }
}
