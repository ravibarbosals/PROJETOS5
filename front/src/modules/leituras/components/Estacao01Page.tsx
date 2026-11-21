import { PageTitle } from '@/components/PageTitle'
import { itemDoPapel } from '@/components/layout/navegacao'
import { ArbovirosesPanel } from '@/modules/indicadores/components/ArbovirosesPanel'
import { LeiturasClimaticasPanel } from '@/modules/leituras/components/LeiturasClimaticasPanel'
import { MapaRiscoPanel } from '@/modules/mapa/components/MapaRiscoPanel'

// REQ-008: EST-01 (Técnico). O mapa é da DEC-038; a matriz de risco e a área
// prioritária esperam a DUV-047.
export function Estacao01Page() {
  const { codigo, titulo, descricao, icone } = itemDoPapel('TEC')

  return (
    <>
      <PageTitle icon={icone} title={`${codigo} · ${titulo}`} description={descricao} />
      <div className="grid gap-8">
        <MapaRiscoPanel />
        <LeiturasClimaticasPanel />
        <ArbovirosesPanel />
      </div>
    </>
  )
}
