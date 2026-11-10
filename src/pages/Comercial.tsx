import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, Check, Loader2, PackageCheck, Plus, Trash2, TrendingUp, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  type Orcamento,
  ROTULO_STATUS_ORC,
  aprovarOrcamento,
  atualizarOrcamento,
  criarOrcamento,
  excluirOrcamento,
  listarOrcamentos,
  resumir,
} from '@/services/comercial'

const DINHEIRO = (v?: number) =>
  v == null || Number.isNaN(v)
    ? '—'
    : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

type Props = {
  onVoltar: () => void
  onAtualizar: () => void
}

export default function Comercial({ onVoltar, onAtualizar }: Props) {
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([])
  const [carregando, setCarregando] = useState(true)
  const [novo, setNovo] = useState(false)
  const [aprovando, setAprovando] = useState<string | null>(null)

  async function carregar() {
    try {
      setOrcamentos(await listarOrcamentos())
    } catch {
      toast.error('Não foi possível carregar os orçamentos')
    }
    setCarregando(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  const resumo = resumir(orcamentos)
  const abertos = orcamentos.filter((o) => ['rascunho', 'enviado', 'negociando'].includes(o.status))
  const fechados = orcamentos
    .filter((o) => ['aprovado', 'perdido'].includes(o.status))
    .sort((a, b) =>
      (b.data_aprovacao ?? b.created ?? '').localeCompare(a.data_aprovacao ?? a.created ?? ''),
    )

  async function aprovar(o: Orcamento) {
    setAprovando(o.id)
    try {
      const r = await aprovarOrcamento(o.id)
      await carregar()
      onAtualizar()
      toast.success(`Aprovado: ${r.os} criada para ${r.obra}`, {
        description: 'A OS já aparece na aba Campo.',
      })
    } catch (e) {
      toast.error('Não foi possível aprovar', { description: String(e) })
    }
    setAprovando(null)
  }

  async function mudarStatus(o: Orcamento, status: string) {
    try {
      await atualizarOrcamento(o.id, {
        status,
        motivo_perda: status === 'perdido' ? o.motivo_perda : '',
      })
      await carregar()
      onAtualizar()
    } catch {
      toast.error('Não foi possível atualizar')
    }
  }

  async function salvarValor(o: Orcamento, texto: string) {
    const limpo = texto
      .replace(/[^\d,.-]/g, '')
      .replace(/\./g, '')
      .replace(',', '.')
    const valor = parseFloat(limpo)
    try {
      await atualizarOrcamento(o.id, { valor: Number.isNaN(valor) ? 0 : valor })
      await carregar()
    } catch {
      toast.error('Não foi possível salvar o valor')
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
                AxiomTec · Comercial
              </p>
              <h1 className="text-xl font-semibold">Orçamentos</h1>
            </div>
            <Button size="sm" className="gap-1" onClick={() => setNovo(true)}>
              <Plus className="h-4 w-4" /> Novo
            </Button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Card>
              <CardContent className="p-3">
                <p className="text-[11px] text-muted-foreground">Em aberto</p>
                <p className="text-lg font-semibold">{resumo.abertos}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <p className="text-[11px] text-muted-foreground">Pipeline aberto</p>
                <p className="text-lg font-semibold">{DINHEIRO(resumo.pipelineAberto)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <p className="text-[11px] text-muted-foreground">Conversão</p>
                <p className="text-lg font-semibold">{resumo.conversao}%</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <p className="text-[11px] text-muted-foreground">Ganho no mês</p>
                <p className="text-lg font-semibold">{DINHEIRO(resumo.ganhoMes)}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-3 px-4 py-4">
        {carregando && (
          <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>
        )}

        {!carregando && orcamentos.length === 0 && (
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="text-base">Nenhum orçamento ainda</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Cadastre o primeiro: cliente, escopo e valor. Quando aprovar, a obra e a OS nascem
              sozinhas na aba Campo.
            </CardContent>
          </Card>
        )}

        {abertos.map((o) => (
          <Card key={o.id}>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{o.cliente}</p>
                  {o.arquiteta && (
                    <p className="truncate text-xs text-muted-foreground">Arq. {o.arquiteta}</p>
                  )}
                  {o.escopo && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{o.escopo}</p>
                  )}
                </div>
                <Badge variant="secondary" className="shrink-0 text-xs">
                  {ROTULO_STATUS_ORC[o.status]}
                </Badge>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">R$</span>
                <Input
                  defaultValue={o.valor ? String(o.valor) : ''}
                  placeholder="valor"
                  inputMode="decimal"
                  className="h-8 w-32 text-sm"
                  onBlur={(e) => salvarValor(o, e.target.value)}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {o.status !== 'enviado' && o.status !== 'negociando' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1 text-xs"
                    onClick={() => mudarStatus(o, 'enviado')}
                  >
                    Enviado
                  </Button>
                )}
                {o.status !== 'negociando' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1 text-xs"
                    onClick={() => mudarStatus(o, 'negociando')}
                  >
                    Negociando
                  </Button>
                )}
                <Button
                  size="sm"
                  className="h-8 gap-1 text-xs"
                  onClick={() => aprovar(o)}
                  disabled={aprovando === o.id}
                >
                  {aprovando === o.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <PackageCheck className="h-3 w-3" />
                  )}
                  Aprovar → gera OS
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 gap-1 text-xs text-destructive"
                  onClick={() => mudarStatus(o, 'perdido')}
                >
                  <X className="h-3 w-3" /> Perdido
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto h-8 gap-1 text-xs"
                  onClick={async () => {
                    await excluirOrcamento(o.id)
                    carregar()
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {fechados.length > 0 && (
          <section className="space-y-2 pt-2">
            <h2 className="text-sm font-semibold">Fechados</h2>
            {fechados.map((o) => (
              <div
                key={o.id}
                className="flex items-center justify-between gap-2 rounded-lg border bg-card p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{o.cliente}</p>
                  <p className="text-xs text-muted-foreground">
                    {DINHEIRO(o.valor)}
                    {o.obra ? ' · OS gerada' : ''}
                  </p>
                </div>
                <Badge
                  variant={o.status === 'aprovado' ? 'default' : 'outline'}
                  className="shrink-0 text-xs"
                >
                  {o.status === 'aprovado' ? (
                    <span className="flex items-center gap-1">
                      <Check className="h-3 w-3" /> Aprovado
                    </span>
                  ) : (
                    'Perdido'
                  )}
                </Badge>
              </div>
            ))}
          </section>
        )}
      </main>

      {novo && (
        <FormNovo
          onFechar={() => setNovo(false)}
          onSalvo={async () => {
            setNovo(false)
            await carregar()
            onAtualizar()
          }}
        />
      )}
    </div>
  )
}

function FormNovo({ onFechar, onSalvo }: { onFechar: () => void; onSalvo: () => void }) {
  const [cliente, setCliente] = useState('')
  const [arquiteta, setArquiteta] = useState('')
  const [escopo, setEscopo] = useState('')
  const [valor, setValor] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    if (!cliente.trim()) {
      toast.error('Diga o nome do cliente')
      return
    }
    setSalvando(true)
    try {
      const limpo = valor
        .replace(/[^\d,.-]/g, '')
        .replace(/\./g, '')
        .replace(',', '.')
      const v = parseFloat(limpo)
      await criarOrcamento({
        cliente: cliente.trim(),
        arquiteta: arquiteta.trim(),
        escopo: escopo.trim(),
        valor: Number.isNaN(v) ? undefined : v,
        status: 'rascunho',
      })
      toast.success('Orçamento criado')
      onSalvo()
    } catch {
      toast.error('Não foi possível criar')
    }
    setSalvando(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40 sm:items-center sm:justify-center">
      <div className="w-full rounded-t-2xl bg-background p-4 shadow-lg sm:max-w-md sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Novo orçamento</h2>
          <Button variant="ghost" size="icon" onClick={onFechar} aria-label="Fechar">
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Cliente *</Label>
            <Input
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              placeholder="Ex.: Marina"
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
            <Label className="text-xs">Escopo</Label>
            <Textarea
              value={escopo}
              onChange={(e) => setEscopo(e.target.value)}
              placeholder="Ex.: Automação LifeSmart — base + aditivo Home Theater 5.1"
              rows={2}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Valor (R$)</Label>
            <Input
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              inputMode="decimal"
              placeholder="Ex.: 45000"
            />
          </div>
          <Button className="w-full gap-2" onClick={salvar} disabled={salvando}>
            {salvando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Criar orçamento
          </Button>
        </div>
      </div>
    </div>
  )
}
