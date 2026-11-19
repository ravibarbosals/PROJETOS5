import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { SchedulerRegistry } from '@nestjs/schedule';
import { EnvironmentVariables, NodeEnv } from '@/core/config/env.validation';
import {
  AvaliacaoAlertasJob,
  NOME_DO_JOB,
} from '@/modules/alertas/avaliacao/jobs/avaliacao-alertas.job';
import type { AvaliacaoAlertasService } from '@/modules/alertas/avaliacao/services/avaliacao-alertas.service';

function setup(nodeEnv = NodeEnv.Development) {
  const avaliacao = { executar: jest.fn() };
  const agenda = {
    addInterval: jest.fn<void, [string, NodeJS.Timeout]>(),
  };
  const valores: Partial<EnvironmentVariables> = {
    NODE_ENV: nodeEnv,
    ALERTA_INTERVALO_MINUTOS: 10,
  };
  const config = {
    get: (chave: keyof EnvironmentVariables) => valores[chave],
  };
  const job = new AvaliacaoAlertasJob(
    avaliacao as unknown as AvaliacaoAlertasService,
    agenda as unknown as SchedulerRegistry,
    config as unknown as ConfigService<EnvironmentVariables, true>,
  );
  return { job, avaliacao, agenda };
}

// DEC-015: agendamento, trava de reentrância e falha isolada.
describe('AvaliacaoAlertasJob', () => {
  let erro: jest.SpyInstance;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    erro = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('schedules every ALERTA_INTERVALO_MINUTOS and runs once on boot', () => {
    jest.useFakeTimers();
    const { job, avaliacao, agenda } = setup();
    avaliacao.executar.mockResolvedValue(null);

    job.onApplicationBootstrap();

    expect(agenda.addInterval).toHaveBeenCalledWith(
      NOME_DO_JOB,
      expect.anything(),
    );
    expect(avaliacao.executar).toHaveBeenCalledTimes(1);
    clearInterval(agenda.addInterval.mock.calls[0][1]);
    jest.useRealTimers();
  });

  it('does not schedule in tests', () => {
    const { job, avaliacao, agenda } = setup(NodeEnv.Test);

    job.onApplicationBootstrap();

    expect(agenda.addInterval).not.toHaveBeenCalled();
    expect(avaliacao.executar).not.toHaveBeenCalled();
  });

  it('skips a run while the previous one is still going', async () => {
    const { job, avaliacao } = setup();
    let terminar: () => void = () => undefined;
    avaliacao.executar.mockReturnValue(
      new Promise<null>((resolve) => {
        terminar = () => resolve(null);
      }),
    );

    const primeira = job.executar();
    await job.executar();
    terminar();
    await primeira;

    expect(avaliacao.executar).toHaveBeenCalledTimes(1);
  });

  it('logs a failure and runs again next time', async () => {
    const { job, avaliacao } = setup();
    avaliacao.executar
      .mockRejectedValueOnce(new Error('banco fora do ar'))
      .mockResolvedValueOnce(null);

    await job.executar();
    await job.executar();

    expect(avaliacao.executar).toHaveBeenCalledTimes(2);
    expect(erro).toHaveBeenCalled();
  });
});
