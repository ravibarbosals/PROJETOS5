import { BellRing, Eye, MapPinned, Waypoints, type LucideIcon } from 'lucide-react'

const DESTAQUES: { icone: LucideIcon; titulo: string; texto: string }[] = [
  {
    icone: MapPinned,
    titulo: 'Monitoramento por RPA',
    texto: 'Chuva, temperatura, áreas de risco e arboviroses, com a fonte e a data de cada dado.',
  },
  {
    icone: BellRing,
    titulo: 'Alertas automáticos',
    texto: 'Os parâmetros do gestor disparam alertas por território, sem esperar ninguém olhar.',
  },
  {
    icone: Waypoints,
    titulo: 'Resposta rastreada',
    texto: 'Cada ação fica na linha do tempo do evento, com hora e responsável.',
  },
]

// Lado da marca do login (TASK-072): só em telas largas.
export function PainelDaMarca() {
  return (
    <aside className="relative hidden overflow-hidden bg-slate-950 text-white lg:flex lg:flex-col">
      {/* Brilho e grade de fundo, só decoração */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(21,93,252,0.55),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(14,165,233,0.25),transparent_50%)]"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:48px_48px]"
      />
      <Eye
        aria-hidden
        className="absolute -right-24 -bottom-24 size-[28rem] text-white/[0.04]"
        strokeWidth={1}
      />

      <div className="relative flex flex-1 flex-col justify-between p-12">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary">
            <Eye className="size-5" aria-hidden />
          </span>
          <span className="leading-tight">
            <span className="block text-lg font-semibold">O Vigia</span>
            <span className="block text-xs text-white/60">Sala de situação</span>
          </span>
        </div>

        <div className="max-w-lg">
          <p className="mb-4 flex items-center gap-3 text-sm font-medium text-sky-300">
            <span className="h-px w-6 bg-sky-300" aria-hidden />
            Vigidesastres · Secretaria de Saúde do Recife
          </p>
          <h2 className="text-5xl leading-[1.05] font-bold tracking-tight">
            Do dado ao alerta, antes do desastre.
          </h2>
          <p className="mt-4 text-lg text-white/70">
            Apoio à decisão em emergências climáticas: o que está acontecendo em cada região do
            Recife e quem já está agindo.
          </p>

          <ul className="mt-10 grid gap-6">
            {DESTAQUES.map(({ icone: Icone, titulo, texto }) => (
              <li key={titulo} className="flex gap-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-sky-300">
                  <Icone className="size-4" aria-hidden />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{titulo}</span>
                  <span className="block text-sm text-white/60">{texto}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-white/40">CESAR School · Projeto 5</p>
      </div>
    </aside>
  )
}
