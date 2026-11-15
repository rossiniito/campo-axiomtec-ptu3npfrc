import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, Check, ChevronDown, ChevronUp, Loader2, Plus, RefreshCw, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  type Obra,
  type StatusObra,
  ORDEM_STATUS,
  STATUS_OBRA,
  atualizarObra,
  contarPorStatus,
  criarObra,
  listarObras,
  mudarStatusObra,
} from '@/services/obras'

type Props = { onVoltar: () => void }

export default function SituacaoObras({ onVoltar }: Props) {
  const [obras, setObras] = useState<Obra[]>([])
  const [carregando, setCarregando] = useState(true)
  const [nova, setNova] = useState(false)
  const [expandida, setExpandida] = useState<string | null>(null)
  const [salvando, setSalvando] = useState<string | null>(null)

  async function carregar() {
    try {
      setObras(await listarObras())
    } catch {
      toast.error('Não foi possível carregar as obras')
    }
    setCarregando(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  const contagem = contarPorStatus(obras)
  const ordenadas = [...obras].sort(
    (a, b) =>
      ORDEM_STATUS.indexOf(a.status ?? 'aguardando') -
      ORDEM_STATUS.indexOf(b.status ?? 'aguardando'),
  )

  async function trocarStatus(obra: Obra, status: StatusObra) {
    setSalvando(obra.id)
    try {
      await mudarStatusObra(obra.id, status)
      await carregar()
      toast.success(`${obra.nome}: ${STATUS_OBRA[status].rotulo}`)
    } catch {
      toast.error('Não foi possível mudar o status')
    }
    setSalvando(null)
  }

  async function salvarSituacao(obra: Obra, texto: string) {
    if ((obra.situacao ?? '') === texto) return
    try {
      await atualizarObra(obra.id, { situacao: texto })
      await carregar()
    } catch {
      toast.error('Não foi possível salvar a descrição')
    }
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="border-b px-4 py-4">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={onVoltar} aria-label="Voltar">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                AxiomTec · Obras
              </p>
              <h1 className="text-xl font-semibold">Situação dos clientes</h1>
            </div>
            <Button size="sm" className="gap-1" onClick={() => setNova(true)}>
              <Plus className="h-4 w-4" /> Nova
            </Button>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {ORDEM_STATUS.filter((s) => (contagem[s] ?? 0) > 0).map((s) => (
              <span
                key={s}
                className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_OBRA[s].cor}`}
              >
                {STATUS_OBRA[s].rotulo}: {contagem[s]}
              </span>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-2 px-4 py-4">
        {carregando && (
          <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>
        )}

        {!carregando && obras.length === 0 && (
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="text-base">Nenhuma obra cadastrada</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Toque em “Nova” para cadastrar a primeira e definir em que pé ela está.
            </CardContent>
          </Card>
        )}

        {ordenadas.map((obra) => {
          const status = (obra.status ?? 'aguardando') as StatusObra
          const meta = STATUS_OBRA[status]
          const aberta = expandida === obra.id

          return (
            <Card key={obra.id}>
              <CardContent className="p-3">
                <button
                  onClick={() => setExpandida(aberta ? null : obra.id)}
                  className="flex w-full items-start gap-2 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{obra.nome}</p>
                    {obra.situacao && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {obra.situacao}
                      </p>
                    )}
                    {obra.arquiteta && (
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        Arq. {obra.arquiteta}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${meta.cor}`}
                    >
                      {meta.rotulo}
                    </span>
                    {aberta ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </button>

                {aberta && (
                  <div className="mt-3 space-y-3 border-t pt-3">
                    <div>
                      <Label className="text-[11px] text-muted-foreground">
                        Descrição da situação
                      </Label>
                      <Textarea
                        defaultValue={obra.situacao ?? ''}
                        placeholder="Ex.: faltando pequenos ajustes na programação"
                        rows={2}
                        className="mt-1 text-sm"
                        onBlur={(e) => salvarSituacao(obra, e.target.value)}
                      />
                    </div>

                    <div>
                      <Label className="text-[11px] text-muted-foreground">Mudar status</Label>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {ORDEM_STATUS.map((s) => (
                          <Button
                            key={s}
                            size="sm"
                            variant={s === status ? 'default' : 'outline'}
                            className="h-7 gap-1 px-2 text-[11px]"
                            disabled={s === status || salvando === obra.id}
                            onClick={() => trocarStatus(obra, s)}
                          >
                            {s === status && <Check className="h-3 w-3" />}
                            {STATUS_OBRA[s].rotulo}
                          </Button>
                        ))}
                      </div>
                      <p className="mt-1.5 text-[11px] text-muted-foreground">{meta.descricao}</p>
                    </div>

                    {obra.status_em && (
                      <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <RefreshCw className="h-3 w-3" />
                        Status alterado em{' '}
                        {new Date(obra.status_em).toLocaleString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </main>

      {nova && (
        <FormNova
          onFechar={() => setNova(false)}
          onSalvo={async () => {
            setNova(false)
            await carregar()
          }}
        />
      )}
    </div>
  )
}

function FormNova({ onFechar, onSalvo }: { onFechar: () => void; onSalvo: () => void }) {
  const [nome, setNome] = useState('')
  const [arquiteta, setArquiteta] = useState('')
  const [endereco, setEndereco] = useState('')
  const [status, setStatus] = useState<StatusObra>('aguardando')
  const [situacao, setSituacao] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    if (!nome.trim()) {
      toast.error('Diga o nome do cliente ou da obra')
      return
    }
    setSalvando(true)
    try {
      await criarObra({
        nome: nome.trim(),
        cliente: nome.trim(),
        arquiteta: arquiteta.trim(),
        endereco: endereco.trim(),
        status,
        situacao: situacao.trim(),
      })
      toast.success('Obra cadastrada')
      onSalvo()
    } catch (e) {
      toast.error('Não foi possível cadastrar', { description: String(e) })
    }
    setSalvando(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40 sm:items-center sm:justify-center">
      <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-background p-4 shadow-lg sm:max-w-md sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Nova obra</h2>
          <Button variant="ghost" size="icon" onClick={onFechar} aria-label="Fechar">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Cliente / obra *</Label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Laise"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Arquiteta / indicador</Label>
            <Input
              value={arquiteta}
              onChange={(e) => setArquiteta(e.target.value)}
              placeholder="Ex.: Dani Funari"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Endereço</Label>
            <Input
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              placeholder="Opcional"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Situação agora</Label>
            <div className="flex flex-wrap gap-1.5">
              {ORDEM_STATUS.map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={s === status ? 'default' : 'outline'}
                  className="h-7 px-2 text-[11px]"
                  onClick={() => setStatus(s)}
                >
                  {STATUS_OBRA[s].rotulo}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Descrição (opcional)</Label>
            <Textarea
              value={situacao}
              onChange={(e) => setSituacao(e.target.value)}
              placeholder="Ex.: equipe da engenharia montando a infra"
              rows={2}
            />
          </div>
          <Button className="w-full gap-2" onClick={salvar} disabled={salvando}>
            {salvando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Cadastrar obra
          </Button>
        </div>
      </div>
    </div>
  )
}
