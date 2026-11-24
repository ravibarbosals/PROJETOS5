import { resumirMeteorologia } from '@/modules/boletins/domain/resumo-meteorologico';
import type { LeituraResponseDto } from '@/modules/paineis/leitura/dto/leitura-response.dto';
import { VariavelClimatica } from '@/modules/paineis/leitura/enums/variavel-climatica.enum';

const ATUALIZADA = new Date('2026-11-20T17:41:00Z');

const leitura = (
  variavel: VariavelClimatica,
  valor: number,
  lidaEm: string,
  fonteAtualizadaEm: Date | null = ATUALIZADA,
  estacao = 'recife',
): LeituraResponseDto => ({
  fonte: 'openmeteo',
  estacao,
  territorio: 'Recife',
  variavel,
  valor,
  lida_em: new Date(lidaEm),
  fonte_atualizada_em: fonteAtualizadaEm,
});

describe('resumirMeteorologia (TASK-032, PR-013)', () => {
  it('sums the rain, keeps the latest hour, the hottest reading and the latest humidity', () => {
    const resumo = resumirMeteorologia([
      leitura(VariavelClimatica.Precipitacao, 0.1, '2026-11-20T10:00:00Z'),
      leitura(VariavelClimatica.Precipitacao, 0.2, '2026-11-20T12:00:00Z'),
      leitura(VariavelClimatica.Precipitacao, 0.4, '2026-11-20T11:00:00Z'),
      leitura(VariavelClimatica.Temperatura, 31.4, '2026-11-20T13:00:00Z'),
      leitura(VariavelClimatica.Temperatura, 29.8, '2026-11-20T16:00:00Z'),
      leitura(VariavelClimatica.Umidade, 80, '2026-11-20T15:00:00Z'),
      leitura(VariavelClimatica.Umidade, 71, '2026-11-20T17:00:00Z'),
    ]);

    expect(resumo).toEqual({
      chuvaAcumulada: 0.7,
      chuvaUltimaHora: { valor: 0.2, lidaEm: new Date('2026-11-20T12:00:00Z') },
      temperaturaMaxima: {
        valor: 31.4,
        lidaEm: new Date('2026-11-20T13:00:00Z'),
      },
      umidadeAtual: { valor: 71, lidaEm: new Date('2026-11-20T17:00:00Z') },
      fontes: ['openmeteo'],
      atualizadaEm: ATUALIZADA,
    });
  });

  it('leaves a variable without readings empty', () => {
    const resumo = resumirMeteorologia([
      leitura(VariavelClimatica.Temperatura, 30, '2026-11-20T13:00:00Z', null),
    ]);

    expect(resumo).toMatchObject({
      chuvaAcumulada: null,
      chuvaUltimaHora: null,
      umidadeAtual: null,
      atualizadaEm: null,
    });
  });

  it('keeps the station with the most rain instead of adding the stations (DEC-034)', () => {
    const P = VariavelClimatica.Precipitacao;
    const U = VariavelClimatica.Umidade;
    const resumo = resumirMeteorologia([
      leitura(P, 3, '2026-11-20T10:00:00Z', ATUALIZADA, 'rpa1'),
      leitura(P, 1, '2026-11-20T11:00:00Z', ATUALIZADA, 'rpa1'),
      leitura(P, 2, '2026-11-20T10:00:00Z', ATUALIZADA, 'rpa6'),
      leitura(P, 5, '2026-11-20T11:00:00Z', ATUALIZADA, 'rpa6'),
      leitura(U, 70, '2026-11-20T11:00:00Z', ATUALIZADA, 'rpa1'),
      leitura(U, 88, '2026-11-20T11:00:00Z', ATUALIZADA, 'rpa6'),
    ]);

    expect(resumo).toMatchObject({
      chuvaAcumulada: 7,
      chuvaUltimaHora: { valor: 5, lidaEm: new Date('2026-11-20T11:00:00Z') },
      umidadeAtual: { valor: 88, lidaEm: new Date('2026-11-20T11:00:00Z') },
    });
  });

  it('adds the 10-minute rain gauge readings of the last hour (DEC-045)', () => {
    const P = VariavelClimatica.Precipitacao;
    const resumo = resumirMeteorologia([
      leitura(P, 4, '2026-11-20T10:50:00Z', ATUALIZADA, 'A'),
      leitura(P, 1.2, '2026-11-20T11:10:00Z', ATUALIZADA, 'A'),
      leitura(P, 0.8, '2026-11-20T11:20:00Z', ATUALIZADA, 'A'),
      leitura(P, 1.4, '2026-11-20T11:50:00Z', ATUALIZADA, 'B'),
    ]);

    expect(resumo?.chuvaUltimaHora).toEqual({
      valor: 2,
      lidaEm: new Date('2026-11-20T11:50:00Z'),
    });
  });

  it('is null without any reading', () => {
    expect(resumirMeteorologia([])).toBeNull();
  });
});
