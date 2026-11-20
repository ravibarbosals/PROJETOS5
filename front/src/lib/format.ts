// Datas chegam em UTC (DEC-017) e são mostradas no horário do Recife.
  const formatoDataHora = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Recife',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const formatoNumero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 })

  // "2026-10-24T13:05:00Z" → "24/10/2026 10:05"
  export function formatarDataHora(iso: string): string {
    return formatoDataHora.format(new Date(iso)).replace(', ', ' ')
  }

  const formatoDataHoraCurta = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Recife',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  // "2026-10-24T13:05:00Z" → "24/10 10:05", para listas com pouco espaço
  export function formatarDataHoraCurta(iso: string): string {
    return formatoDataHoraCurta.format(new Date(iso)).replace(', ', ' ')
  }

  // 1234.5 → "1.234,5"; até 3 casas, como o decimal(12,3) do banco
  export function formatarNumero(valor: number): string {
    return formatoNumero.format(valor)
  }

  // Número digitado em pt-BR ("62,5" ou "1.234,5") → 62.5 / 1234.5; null se não for número.
  export function lerNumero(texto: string): number | null {
    const limpo = texto.trim().replace(/\./g, '').replace(',', '.')
    if (limpo === '' || !/^-?\d+(\.\d+)?$/.test(limpo)) return null
    return Number(limpo)
  }

  // Filtra o que é digitado num campo numérico em pt-BR: só dígitos, uma vírgula
  // (o ponto vira vírgula), até `casas` decimais e, se permitido, o sinal no início.
  export function filtrarNumero(
    texto: string,
    { casas = 3, negativo = true }: { casas?: number; negativo?: boolean } = {},
  ): string {
    const sinal = negativo && texto.trimStart().startsWith('-') ? '-' : ''
    let inteiro = ''
    let decimal: string | null = null
    for (const c of texto) {
      if (c >= '0' && c <= '9') {
        if (decimal === null) inteiro += c
        else if (decimal.length < casas) decimal += c
      } else if ((c === ',' || c === '.') && casas > 0 && decimal === null) {
        decimal = ''
      }
    }
    return sinal + inteiro + (decimal === null ? '' : `,${decimal}`)
  }

  // Valor para pré-preencher um campo editável: 1234.5 → "1234,5" (sem milhar,
  // que o filtro do campo não aceita).
  export function numeroParaCampo(valor: number): string {
    return String(valor).replace('.', ',')
  }

  // Duração em segundos para leitura rápida: 45 → "45 s"; 2280 → "38 min"; 3900 → "1 h 05 min".
  export function formatarDuracao(segundos: number): string {
    if (segundos < 60) return `${segundos} s`
    const minutos = Math.round(segundos / 60)
    if (minutos < 60) return `${minutos} min`
    const horas = Math.floor(minutos / 60)
    return `${horas} h ${String(minutos % 60).padStart(2, '0')} min`
  }
