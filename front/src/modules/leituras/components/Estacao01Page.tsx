import { PageTitle } from '@/components/PageTitle'
import { itemDoPapel } from '@/components/layout/navegacao'
import { ArbovirosesPanel } from '@/modules/indicadores/components/ArbovirosesPanel'
import { LeiturasClimaticasPanel } from '@/modules/leituras/components/LeiturasClimaticasPanel'

// REQ-008: EST-01 (Técnico). O mapa e a matriz de risco dependem de dados que
// o gold ainda não tem (TASK-064).
export function Estacao01Page() {
  const { codigo, titulo, descricao, icone } = itemDoPapel('TEC')

  return (
    <>
      <PageTitle icon={icone} title={`${codigo} · ${titulo}`} description={descricao} />
      <div className="grid gap-8">
        <LeiturasClimaticasPanel />
        <ArbovirosesPanel />
      </div>
    </>
  )
}
