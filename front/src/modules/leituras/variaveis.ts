 import type { Variavel } from '@/modules/leituras/types'

  // Variáveis que a pipeline grava em gold.leitura_climatica, na ordem das listas.
  export const VARIAVEIS: Variavel[] = ['precipitacao_mm', 'temperatura_c', 'umidade_pct', 'pressao_hpa']

  // DEC-033: a tela mostra o nome legível; a API continua com o nome do gold.
  const ROTULO: Record<Variavel, string> = {
    precipitacao_mm: 'Chuva (mm)',
    temperatura_c: 'Temperatura (°C)',
    umidade_pct: 'Umidade (%)',
    pressao_hpa: 'Pressão (hPa)',
  }

  // Variável fora da lista (dado antigo ou fonte nova) aparece com o nome técnico.
  export function rotuloVariavel(variavel: string): string {
    return ROTULO[variavel as Variavel] ?? variavel
  }
