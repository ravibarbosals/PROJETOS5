import { PageTitle } from '@/components/PageTitle'
import { itemDoPapel } from '@/components/layout/navegacao'
import { DecisoesPendentesPanel } from '@/modules/indicadores/components/DecisoesPendentesPanel'
import { PessoasEmRiscoPanel } from '@/modules/indicadores/components/PessoasEmRiscoPanel'
import { TempoAcionamentoPanel } from '@/modules/indicadores/components/TempoAcionamentoPanel'

// REQ-010: EST-03 (Gestão Institucional). Pessoas em risco (RN-016),
// decisões pendentes (PR-033) e tempo de acionamento (REQ-018). A cobertura de
// resposta saiu com os dados assistenciais (PR-024).
export function Estacao03Page() {
  const { codigo, titulo, descricao, icone } = itemDoPapel('GIN')

  return (
    <>
      <PageTitle icon={icone} title={`${codigo} · ${titulo}`} description={descricao} />
      <div className="grid gap-8">
        <div className="grid gap-8 lg:grid-cols-2">
          <PessoasEmRiscoPanel />
          <DecisoesPendentesPanel />
        </div>
        <section className="grid gap-4" aria-labelledby="titulo-tempo-acionamento">
          <h2 id="titulo-tempo-acionamento" className="text-lg font-semibold">
            Tempo de acionamento
          </h2>
          <TempoAcionamentoPanel />
        </section>
      </div>
    </>
  )
}
