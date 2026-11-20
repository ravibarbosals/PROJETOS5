import { useId, useState, type FormEvent } from 'react'
import { ErrorAlert } from '@/components/ErrorAlert'
import { FormField } from '@/components/FormField'
import { SelectField } from '@/components/SelectField'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { filtrarNumero, formatarNumero } from '@/lib/format'
import { describeApiError } from '@/lib/http'
import { useAgirSobreAlerta } from '@/modules/alertas/hooks/useAlertas'
import type { AcaoManual, Alerta } from '@/modules/alertas/types'

// RN-015 #8 (ck_alerta_acao_manual_motivo).
const MOTIVO_MIN = 10
const MOTIVO_MAX = 2000
// RN-015 #6.
const HORAS_MAX = 24

const ACOES: Record<AcaoManual, { rotulo: string; explicacao: string }> = {
  encerrar: {
    rotulo: 'Encerrar',
    explicacao: 'Encerra o alerta agora. Ele continua no histórico e no tempo de acionamento.',
  },
  prorrogar: {
    rotulo: 'Prorrogar',
    explicacao:
      'Mantém o alerta ativo pelo prazo informado, mesmo que as leituras normalizem. Depois o job volta a decidir.',
  },
  invalidar: {
    rotulo: 'Invalidar',
    explicacao:
      'Marca como falso positivo (leitura errada da fonte). O alerta sai do tempo médio de acionamento.',
  },
}

interface AcaoAlertaDialogProps {
  /** Alerta em ação; sem alerta, o diálogo fica fechado. */
  alerta?: Alerta
  /** Ações que o papel do usuário permite (PER-014, PER-015). */
  acoes: AcaoManual[]
  onClose: () => void
}

export function AcaoAlertaDialog({ alerta, acoes, onClose }: AcaoAlertaDialogProps) {
  return (
    <Dialog open={!!alerta} onOpenChange={(aberto) => !aberto && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agir sobre o alerta #{alerta?.id}</DialogTitle>
          <DialogDescription>
            {alerta &&
              `${alerta.nivel} · ${alerta.parametro.variavel} em ${alerta.territorio} · leitura ${formatarNumero(alerta.valor_lido)}`}
          </DialogDescription>
        </DialogHeader>
        {alerta && <AcaoAlertaForm key={alerta.id} alerta={alerta} acoes={acoes} onDone={onClose} />}
      </DialogContent>
    </Dialog>
  )
}

function AcaoAlertaForm({
  alerta,
  acoes,
  onDone,
}: {
  alerta: Alerta
  acoes: AcaoManual[]
  onDone: () => void
}) {
  const motivoId = useId()
  const [acao, setAcao] = useState<AcaoManual>(acoes[0])
  const [horas, setHoras] = useState('2')
  const [motivo, setMotivo] = useState('')
  const agir = useAgirSobreAlerta()

  const horasLidas = Number(horas)
  const horasValidas = Number.isInteger(horasLidas) && horasLidas >= 1 && horasLidas <= HORAS_MAX
  const motivoCurto = motivo.trim().length < MOTIVO_MIN
  const podeConfirmar =
    !motivoCurto && (acao !== 'prorrogar' || horasValidas) && !agir.isPending

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!podeConfirmar) return
    agir.mutate(
      {
        id: alerta.id,
        acao,
        dados: {
          motivo: motivo.trim(),
          ...(acao === 'prorrogar' && { horas: horasLidas }),
        },
      },
      { onSuccess: onDone },
    )
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
      <SelectField
        label="Ação"
        value={acao}
        onChange={(e) => {
          setAcao(e.target.value as AcaoManual)
          agir.reset()
        }}
        options={acoes.map((a) => ({ valor: a, rotulo: ACOES[a].rotulo }))}
      />
      <p className="-mt-2 text-sm text-muted-foreground">{ACOES[acao].explicacao}</p>

      {acao === 'prorrogar' && (
        <div className="grid gap-2">
          <FormField
            label="Prazo (horas)"
            inputMode="numeric"
            required
            aria-invalid={!horasValidas}
            value={horas}
            onChange={(e) => setHoras(filtrarNumero(e.target.value, { casas: 0, negativo: false }))}
          />
          {!horasValidas && (
            <p className="text-sm text-destructive">Inteiro de 1 a {HORAS_MAX}</p>
          )}
        </div>
      )}

      <div className="grid gap-2">
        <Label htmlFor={motivoId}>Motivo</Label>
        <Textarea
          id={motivoId}
          required
          maxLength={MOTIVO_MAX}
          placeholder="Ex.: equipes confirmaram normalidade nas áreas monitoradas"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Fica registrado com seu nome e a hora (mínimo de {MOTIVO_MIN} caracteres).
        </p>
      </div>

      {agir.isError && <ErrorAlert>{describeApiError(agir.error)}</ErrorAlert>}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button
          type="submit"
          variant={acao === 'invalidar' ? 'destructive' : 'default'}
          disabled={!podeConfirmar}
        >
          {agir.isPending ? 'Salvando...' : ACOES[acao].rotulo}
        </Button>
      </DialogFooter>
    </form>
  )
}
