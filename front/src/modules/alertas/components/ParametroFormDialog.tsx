import { useState, type FormEvent } from 'react'
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
import { filtrarNumero, lerNumero, numeroParaCampo } from '@/lib/format'
import { describeApiError } from '@/lib/http'
import { useAlterarParametro, useCriarParametro } from '@/modules/alertas/hooks/useAlertas'
import type { NivelAlerta, ParametroAlerta } from '@/modules/alertas/types'
import { VARIAVEIS, rotuloVariavel } from '@/modules/leituras/variaveis'

// MOD-002: só variáveis do gold. Texto livre deixava cadastrar uma variável
// que nunca dispara.
const VARIAVEIS_GOLD: string[] = VARIAVEIS

// Territórios com leitura no gold. A granularidade (bairro, RPA) ainda está em
// aberto (DUV-009); hoje a pipeline só grava o Recife inteiro.
const TERRITORIOS_GOLD = ['Recife']

// RN-012: só a chuva é somada na janela; nas outras vale a leitura da hora.
const VARIAVEL_ACUMULADA = 'precipitacao_mm'

// ck_parametro_alerta_janela_horas.
const JANELA_MAX = 72

const NIVEIS: { valor: NivelAlerta; rotulo: string }[] = [
  { valor: 'MODERADO', rotulo: 'Moderado' },
  { valor: 'ALTO', rotulo: 'Alto' },
]

interface ParametroFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Sem parâmetro: cadastro. Com parâmetro: edição de limiares, janela e nível. */
  parametro?: ParametroAlerta
}

export function ParametroFormDialog({ open, onOpenChange, parametro }: ParametroFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{parametro ? 'Editar parâmetro' : 'Novo parâmetro'}</DialogTitle>
          <DialogDescription>
            Toda alteração fica no histórico, com autor e valores anterior e novo.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <ParametroForm
            key={parametro?.id ?? 'novo'}
            parametro={parametro}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function lerJanela(texto: string): number | null {
  const valor = lerNumero(texto)
  return valor !== null && Number.isInteger(valor) && valor >= 1 && valor <= JANELA_MAX
    ? valor
    : null
}

function ParametroForm({ parametro, onDone }: { parametro?: ParametroAlerta; onDone: () => void }) {
  const [variavel, setVariavel] = useState(parametro?.variavel ?? VARIAVEIS_GOLD[0])
  const [territorio, setTerritorio] = useState(parametro?.territorio ?? TERRITORIOS_GOLD[0])
  const [limiar, setLimiar] = useState(parametro ? numeroParaCampo(parametro.limiar) : '')
  const [limiarSaida, setLimiarSaida] = useState(
    parametro ? numeroParaCampo(parametro.limiar_saida) : '',
  )
  const [janela, setJanela] = useState(parametro ? String(parametro.janela_horas) : '1')
  const [nivel, setNivel] = useState<NivelAlerta>(parametro?.nivel ?? 'MODERADO')
  const criar = useCriarParametro()
  const alterar = useAlterarParametro()
  const mutation = parametro ? alterar : criar

  const limiarLido = lerNumero(limiar)
  const limiarSaidaLido = lerNumero(limiarSaida)
  const janelaLida = lerJanela(janela)
  const limiarInvalido = limiar.trim() !== '' && limiarLido === null
  const limiarSaidaInvalido = limiarSaida.trim() !== '' && limiarSaidaLido === null
  const janelaInvalida = janela.trim() !== '' && janelaLida === null
  // DEC-029: a histerese só funciona com a saída abaixo do disparo.
  const saidaAcimaDoLimiar =
    limiarLido !== null && limiarSaidaLido !== null && limiarSaidaLido >= limiarLido
  const acumulada = variavel === VARIAVEL_ACUMULADA

  // A edição mostra a variável e o território do parâmetro mesmo fora da lista.
  const variaveis = VARIAVEIS_GOLD.includes(variavel) ? VARIAVEIS_GOLD : [variavel, ...VARIAVEIS_GOLD]
  const territorios = TERRITORIOS_GOLD.includes(territorio)
    ? TERRITORIOS_GOLD
    : [territorio, ...TERRITORIOS_GOLD]

  const podeSalvar =
    limiarLido !== null &&
    limiarSaidaLido !== null &&
    janelaLida !== null &&
    !saidaAcimaDoLimiar &&
    !mutation.isPending

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (limiarLido === null || limiarSaidaLido === null || janelaLida === null) return
    const campos = {
      limiar: limiarLido,
      limiar_saida: limiarSaidaLido,
      janela_horas: janelaLida,
      nivel,
    }
    if (parametro) {
      alterar.mutate({ id: parametro.id, dados: campos }, { onSuccess: onDone })
      return
    }
    criar.mutate(
      { variavel, territorio, ...campos },
      { onSuccess: onDone },
    )
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
      {/* Variável e território identificam o parâmetro: não mudam na edição. */}
      <SelectField
        label="Variável"
        disabled={!!parametro}
        value={variavel}
        onChange={(e) => setVariavel(e.target.value)}
        options={variaveis.map((v) => ({ valor: v, rotulo: rotuloVariavel(v) }))}
      />
      <SelectField
        label="Território"
        disabled={!!parametro}
        value={territorio}
        onChange={(e) => setTerritorio(e.target.value)}
        options={territorios.map((t) => ({ valor: t, rotulo: t }))}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <FormField
            label="Limiar"
            inputMode="decimal"
            required
            aria-invalid={limiarInvalido}
            value={limiar}
            onChange={(e) => setLimiar(filtrarNumero(e.target.value))}
          />
          {limiarInvalido && <p className="text-sm text-destructive">Informe um número</p>}
        </div>
        <div className="grid gap-2">
          <FormField
            label="Limiar de saída"
            inputMode="decimal"
            required
            aria-invalid={limiarSaidaInvalido || saidaAcimaDoLimiar}
            value={limiarSaida}
            onChange={(e) => setLimiarSaida(filtrarNumero(e.target.value))}
          />
          {limiarSaidaInvalido && <p className="text-sm text-destructive">Informe um número</p>}
          {saidaAcimaDoLimiar && (
            <p className="text-sm text-destructive">Deve ser menor que o limiar</p>
          )}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <FormField
            label="Janela (horas)"
            inputMode="numeric"
            required
            aria-invalid={janelaInvalida}
            value={janela}
            onChange={(e) => setJanela(filtrarNumero(e.target.value, { casas: 0, negativo: false }))}
          />
          {janelaInvalida && (
            <p className="text-sm text-destructive">Inteiro de 1 a {JANELA_MAX}</p>
          )}
        </div>
        <SelectField
          label="Nível"
          value={nivel}
          onChange={(e) => setNivel(e.target.value as NivelAlerta)}
          options={NIVEIS}
        />
      </div>
      <p className="-mt-2 text-sm text-muted-foreground">
        {acumulada
          ? 'Dispara quando a chuva somada na janela chega ao limiar e encerra depois de ficar abaixo do limiar de saída.'
          : 'Dispara quando a leitura chega ao limiar e encerra depois de ficar abaixo do limiar de saída. A janela só soma a chuva.'}
      </p>

      {mutation.isError && <ErrorAlert>{describeApiError(mutation.error)}</ErrorAlert>}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!podeSalvar}>
          {mutation.isPending ? 'Salvando...' : 'Salvar'}
        </Button>
      </DialogFooter>
    </form>
  )
}
