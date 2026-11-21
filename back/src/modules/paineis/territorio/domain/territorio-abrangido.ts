// DEC-034, DEC-035: um território abrange as próprias leituras e as dos
// territórios filhos (o Recife abrange as 6 RPAs). Território fora do catálogo
// abrange só as próprias.
export function sqlTerritorioAbrangido(coluna: string, parametro: string) {
  return `(${coluna} = ${parametro} OR ${coluna} IN (
    SELECT nome FROM gold.territorio WHERE pai = ${parametro}))`;
}
