import { resumirMeteorologia } from '@/modules/boletins/domain/resumo-meteorologico';
import type { LeituraResponseDto } from '@/modules/paineis/leitura/dto/leitura-response.dto';
import { VariavelClimatica } from '@/modules/paineis/leitura/enums/variavel-climatica.enum';

const ATUALIZADA = new Date('2026-11-20T17:41:00Z');

const leitura = (
  variavel: VariavelClimatica,
  valor: number,
  lidaEm: string,
  fonteAtualizadaEm: Date | null = ATUALIZADA,
): LeituraResponseDto => ({
  fonte: 'openmeteo',
  estacao: 'recife',
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

  it('is null without any reading', () => {
    expect(resumirMeteorologia([])).toBeNull();
  });
});
