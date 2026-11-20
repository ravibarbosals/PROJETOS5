import { useState, type ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { formatarDataHora, formatarNumero } from '@/lib/format'
import { ROTULO_MOTIVO, prorrogado } from '@/modules/alertas/situacao'
import type { Alerta } from '@/modules/alertas/types'
import { rotuloVariavel } from '@/modules/leituras/variaveis'

interface AlertaDetalheSheetProps {
  /** Alerta aberto; sem alerta, o painel fica fechado. */
  alerta?: Alerta
  onClose: () => void
  /** Com a função, o ativo ganha o botão de ação manual (PER-014, PER-015). */
  onAgir?: (alerta: Alerta) => void
}

// Tudo o que não cabe na lista: a leitura que disparou, com fonte e hora
// (REQ-005 #2), a atualização da fonte (REQ-019), o escalonamento (RN-012 #5) e
// como o alerta terminou (RN-015).
export function AlertaDetalheSheet({ alerta, onClose, onAgir }: AlertaDetalheSheetProps) {
  return (
    <Sheet open={!!alerta} onOpenChange={(aberto) => !aberto && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {alerta && <Detalhe alerta={alerta} onAgir={onAgir} />}
      </SheetContent>
    </Sheet>
  )
}

function Detalhe({ alerta, onAgir }: { alerta: Alerta; onAgir?: (alerta: Alerta) => void }) {
  const ativo = alerta.status === 'ATIVO'
  const [agora] = useState(() => Date.now())

  return (
    <>
      <SheetHeader>
        <SheetTitle>Alerta #{alerta.id}</SheetTitle>
        <SheetDescription>
          {rotuloVariavel(alerta.parametro.variavel)} em {alerta.territorio}
        </SheetDescription>
        <div className="flex gap-2">
          <Badge variant="secondary">{alerta.nivel}</Badge>
          <Badge variant={ativo ? 'destructive' : 'outline'}>{ativo ? 'Ativo' : 'Encerrado'}</Badge>
        </div>
      </SheetHeader>

      <dl className="grid gap-4 px-4 text-sm">
        <Item rotulo="1ª leitura">
          {formatarNumero(alerta.valor_lido)} em {formatarDataHora(alerta.lida_em)}
        </Item>
        <Item rotulo="Máximo do incidente">
          {formatarNumero(alerta.valor_maximo)} (limiar {formatarNumero(alerta.parametro.limiar)})
        </Item>
        <Item rotulo="Última leitura">{formatarDataHora(alerta.ultima_leitura_em)}</Item>
        <Item rotulo="Fonte">
          {alerta.fonte}
          {alerta.fonte_atualizada_em
            ? ` · atualizada em ${formatarDataHora(alerta.fonte_atualizada_em)}`
            : ' · sem coleta registrada'}
        </Item>
        <Item rotulo="Disparado">{formatarDataHora(alerta.disparado_em)}</Item>
        {alerta.escalonado_em && (
          <Item rotulo="Escalonado para ALTO">{formatarDataHora(alerta.escalonado_em)}</Item>
        )}
        {alerta.prorrogado_ate && (
          // "Venceu" só faz sentido no ativo: no encerrado, o prazo pode ter sido
          // interrompido pelo encerramento.
          <Item
            rotulo={
              ativo && !prorrogado(alerta, agora) ? 'Prorrogação venceu em' : 'Prorrogado até'
            }
          >
            {formatarDataHora(alerta.prorrogado_ate)}
          </Item>
        )}
        {alerta.encerrado_em && (
          <Item rotulo="Encerrado">
            {formatarDataHora(alerta.encerrado_em)}
            {alerta.motivo_encerramento && ` · ${ROTULO_MOTIVO[alerta.motivo_encerramento]}`}
          </Item>
        )}
      </dl>

      {ativo && onAgir && (
        <div className="px-4">
          <Button onClick={() => onAgir(alerta)}>Agir sobre o alerta</Button>
        </div>
      )}
    </>
  )
}

function Item({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-muted-foreground">{rotulo}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  )
}
