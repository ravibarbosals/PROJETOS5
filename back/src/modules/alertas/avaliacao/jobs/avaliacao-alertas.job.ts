import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { EnvironmentVariables, NodeEnv } from '@/core/config/env.validation';
import { AvaliacaoAlertasService } from '@/modules/alertas/avaliacao/services/avaliacao-alertas.service';

export const NOME_DO_JOB = 'avaliacao-alertas';

// DEC-015: agenda a avaliação a cada ALERTA_INTERVALO_MINUTOS e roda uma vez na
// subida. Nos testes não agenda: os e2e chamam o service direto.
@Injectable()
export class AvaliacaoAlertasJob implements OnApplicationBootstrap {
  private readonly logger = new Logger(AvaliacaoAlertasJob.name);
  private emExecucao = false;

  constructor(
    private readonly avaliacao: AvaliacaoAlertasService,
    private readonly agenda: SchedulerRegistry,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  onApplicationBootstrap() {
    if (this.config.get('NODE_ENV', { infer: true }) === NodeEnv.Test) return;
    const minutos = this.config.get('ALERTA_INTERVALO_MINUTOS', {
      infer: true,
    });
    this.agenda.addInterval(
      NOME_DO_JOB,
      setInterval(() => void this.executar(), minutos * 60 * 1000),
    );
    void this.executar();
  }

  // Trava de reentrância: uma execução lenta não se sobrepõe à próxima. Entre
  // instâncias, quem garante é a trava do PostgreSQL no service.
  async executar(): Promise<void> {
    if (this.emExecucao) {
      this.logger.warn('Avaliação anterior ainda em andamento; pulando');
      return;
    }
    this.emExecucao = true;
    try {
      const resumo = await this.avaliacao.executar();
      if (resumo)
        this.logger.log(`Avaliação de alertas: ${JSON.stringify(resumo)}`);
    } catch (erro) {
      // Uma falha (banco fora do ar etc.) não pode impedir as próximas.
      this.logger.error('Falha na avaliação de alertas', erro as Error);
    } finally {
      this.emExecucao = false;
    }
  }
}
