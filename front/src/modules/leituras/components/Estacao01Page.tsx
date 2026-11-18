import { PageTitle } from '@/components/PageTitle'
import { itemDoPapel } from '@/components/layout/navegacao'
import { LeiturasClimaticasPanel } from '@/modules/leituras/components/LeiturasClimaticasPanel'

// REQ-008: EST-01 (Técnico). Mapa, indicadores epidemiológicos e matriz de
// risco dependem de dados que o gold ainda não tem (TASK-041).
export function Estacao01Page() {
  const { codigo, titulo, descricao, icone } = itemDoPapel('TEC')

  return (
    <>
      <PageTitle icon={icone} title={`${codigo} · ${titulo}`} description={descricao} />
      <LeiturasClimaticasPanel />
    </>
  )
}