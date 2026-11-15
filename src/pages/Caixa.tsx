/* Caixa: quanto entra, quanto sai e o que está atrasado.

   A pergunta que fecha a sua dor nº 1: "tenho dinheiro nos próximos 30 dias?"
   Mostra recebimento (sinal + parcelas) e pagamento (compra do fornecedor) no
   mesmo lugar — porque ver só a entrada faz o dono gastar dinheiro que já tem dono. */
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ChevronLeft, Loader2, Plus, TrendingDown, TrendingUp, X } from 'lucide-react'
import { toast } from 'sonner'
import { brl } from '@/services/financeiro'
import {
  type Janela,
  type Pagamento,
  type Recebimento,
  ROTULO_FORMA,
  darBaixaRecebimento,
  listarPagamentos,
  listarRecebimentos,
  pagarConta,
  projetarCaixa,
} from '@/services/recebimento'
import { listarObras } from '@/services/acesso'
import { listarFornecedores } from '@/services/ciclo'

type Props = { onVoltar: () => void }

const dataBR = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—'

export default function Caixa({ onVoltar }: Props) {
  const [recebimentos, setRecebimentos] = useState<Recebimento[]>([])
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([])
  const [janelas, setJanelas] = useState<Janela[]>([])
  const [atraso, setAtraso] = useState({ receber: 0, pagar: 0 })
  const [carregando, setCarregando] = useState(true)
  const [aba, setAba] = useState<'receber' | 'pagar'>('receber')
  const [novoPagamento, setNovoPagamento] = useState(false)

  async function carregar() {
    try {
      const [r, p] = await Promise.all([listarRecebimentos(), listarPagamentos()])
      setRecebimentos(r)
      setPagamentos(p)
      const proj = projetarCaixa(r, p)
      setJanelas(proj.janelas)
      setAtraso({ receber: proj.atrasadoReceber, pagar: proj.atrasadoPagar })
    } catch {
      toast.error('Não foi possível carregar o caixa')
    }
    setCarregando(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  async function baixarRecebimento(r: Recebimento) {
    const v = prompt(`Quanto entrou de "${r.descricao ?? 'parcela'}"?`, String(r.valor))
    if (!v) return
    const valor = parseFloat(v.replace(',', '.'))
    if (Number.isNaN(valor)) {
      toast.error('Valor inválido')
      return
    }
    try {
      await darBaixaRecebimento(r.id, valor, r.forma ?? 'pix', new Date().toISOString())
      await carregar()
      toast.success('Recebimento baixado')
    } catch {
      toast.error('Não foi possível dar baixa')
    }
  }

  async function baixarPagamento(p: Pagamento) {
    const v = prompt(`Quanto foi pago de "${p.descricao}"?`, String(p.valor))
    if (!v) return
    const valor = parseFloat(v.replace(',', '.'))
    if (Number.isNaN(valor)) {
      toast.error('Valor inválido')
      return
    }
    try {
      await pagarConta(p.id, valor, new Date().toISOString())
      await carregar()
      toast.success('Pagamento baixado')
    } catch {
      toast.error('Não foi possível dar baixa')
    }
  }

  const listaReceber = recebimentos.filter(
    (r) => r.status !== 'recebido' && r.status !== 'cancelado',
  )
  const listaPagar = pagamentos.filter((p) => p.status !== 'pago' && p.status !== 'cancelado')

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-10 border-b bg-background px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onVoltar} aria-label="Voltar">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              AxiomTec · Financeiro
            </p>
            <h1 className="text-lg font-semibold">Caixa</h1>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={() => setNovoPagamento(true)}
          >
            <Plus className="h-4 w-4" /> Conta
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-3 px-4 py-4">
        {carregando && (
          <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>
        )}

        {!carregando && (
          <>
            <Card>
              <CardContent className="space-y-2 p-4">
                <p className="text-xs text-muted-foreground">Projeção de caixa</p>
                <div className="space-y-1.5">
                  {janelas.map((j) => (
                    <div key={j.rotulo} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{j.rotulo}</span>
                      <span className="flex items-center gap-3 tabular-nums">
                        <span className="text-emerald-700">+{brl(j.receber)}</span>
                        <span className="text-destructive">−{brl(j.pagar)}</span>
                        <span
                          className={`w-24 text-right font-semibold ${
                            j.saldo >= 0 ? 'text-emerald-700' : 'text-destructive'
                          }`}
                        >
                          {brl(j.saldo)}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {(atraso.receber > 0 || atraso.pagar > 0) && (
              <div className="grid grid-cols-2 gap-2">
                <Card className="border-amber-200 bg-amber-50">
                  <CardContent className="p-3">
                    <p className="text-xs text-amber-800">Atrasado a receber</p>
                    <p className="text-base font-semibold text-amber-900">{brl(atraso.receber)}</p>
                  </CardContent>
                </Card>
                <Card className="border-destructive/20 bg-destructive/5">
                  <CardContent className="p-3">
                    <p className="text-xs text-destructive">Atrasado a pagar</p>
                    <p className="text-base font-semibold text-destructive">{brl(atraso.pagar)}</p>
                  </CardContent>
                </Card>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                size="sm"
                variant={aba === 'receber' ? 'default' : 'outline'}
                className="flex-1 gap-1"
                onClick={() => setAba('receber')}
              >
                <TrendingUp className="h-3.5 w-3.5" /> A receber ({listaReceber.length})
              </Button>
              <Button
                size="sm"
                variant={aba === 'pagar' ? 'default' : 'outline'}
                className="flex-1 gap-1"
                onClick={() => setAba('pagar')}
              >
                <TrendingDown className="h-3.5 w-3.5" /> A pagar ({listaPagar.length})
              </Button>
            </div>

            {aba === 'receber' && listaReceber.length === 0 && (
              <Card className="border-dashed">
                <CardContent className="p-6 text-center text-sm text-muted-foreground">
                  Nenhuma parcela em aberto. O cronograma é gerado quando você aprova um orçamento.
                </CardContent>
              </Card>
            )}

            {aba === 'receber' &&
              listaReceber.map((r) => {
                const venceu = new Date(r.vencimento) < new Date()
                return (
                  <Card key={r.id} className={venceu ? 'border-amber-300' : ''}>
                    <CardContent className="flex items-center justify-between gap-2 p-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {r.expand?.obra?.nome ?? 'obra'}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {r.descricao ?? r.tipo} · vence {dataBR(r.vencimento)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <div className="text-right">
                          <p className="text-sm font-semibold">{brl(r.valor)}</p>
                          {venceu && (
                            <Badge variant="outline" className="text-[10px] text-amber-700">
                              vencido
                            </Badge>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => baixarRecebimento(r)}
                        >
                          Recebi
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}

            {aba === 'pagar' && listaPagar.length === 0 && (
              <Card className="border-dashed">
                <CardContent className="p-6 text-center text-sm text-muted-foreground">
                  Nenhuma conta a pagar registrada. Toque em "Conta" e lance o que o fornecedor vai
                  cobrar — é isso que mostra o buraco antes dele acontecer.
                </CardContent>
              </Card>
            )}

            {aba === 'pagar' &&
              listaPagar.map((p) => {
                const venceu = new Date(p.vencimento) < new Date()
                return (
                  <Card key={p.id} className={venceu ? 'border-destructive/40' : ''}>
                    <CardContent className="flex items-center justify-between gap-2 p-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{p.descricao}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {p.expand?.fornecedor?.nome ?? 'sem fornecedor'} · vence{' '}
                          {dataBR(p.vencimento)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <div className="text-right">
                          <p className="text-sm font-semibold text-destructive">{brl(p.valor)}</p>
                          {venceu && (
                            <Badge variant="destructive" className="text-[10px]">
                              vencido
                            </Badge>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => baixarPagamento(p)}
                        >
                          Paguei
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}

            <p className="px-1 pt-2 text-[11px] leading-relaxed text-muted-foreground">
              A projeção soma o que ainda não foi pago nem recebido, pela data de vencimento.
              Vencido sem baixa entra na primeira janela. Recebimento é sinal + parcelas fixas; não
              há medição.
            </p>
          </>
        )}
      </main>

      {novoPagamento && (
        <FormPagamento
          onFechar={() => setNovoPagamento(false)}
          onSalvo={async () => {
            setNovoPagamento(false)
            await carregar()
          }}
        />
      )}
    </div>
  )
}

function FormPagamento({ onFechar, onSalvo }: { onFechar: () => void; onSalvo: () => void }) {
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [vencimento, setVencimento] = useState(new Date().toISOString().slice(0, 10))
  const [obra, setObra] = useState('')
  const [fornecedor, setFornecedor] = useState('')
  const [categoria, setCategoria] = useState('equipamento')
  const [obras, setObras] = useState<{ id: string; nome: string }[]>([])
  const [fornecedores, setFornecedores] = useState<{ id: string; nome: string }[]>([])
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    Promise.all([listarObras(), listarFornecedores()])
      .then(([o, f]) => {
        setObras(o)
        setFornecedores(f)
      })
      .catch(() => undefined)
  }, [])

  async function salvar() {
    const v = parseFloat(valor.replace(',', '.'))
    if (!descricao.trim() || Number.isNaN(v) || v <= 0) {
      toast.error('Informe o que é e o valor')
      return
    }
    setSalvando(true)
    try {
      const pbmod = await import('@/lib/pocketbase/client')
      await pbmod.default.collection('pagamentos').create({
        descricao: descricao.trim(),
        valor: v,
        vencimento: new Date(vencimento + 'T12:00:00').toISOString(),
        obra: obra || undefined,
        fornecedor: fornecedor || undefined,
        categoria,
        status: 'a_pagar',
      })
      toast.success('Conta lançada')
      onSalvo()
    } catch (e) {
      toast.error('Não foi possível lançar', { description: String(e) })
    }
    setSalvando(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40 sm:items-center sm:justify-center">
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-background p-4 shadow-lg sm:max-w-md sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Conta a pagar</h2>
          <Button variant="ghost" size="icon" onClick={onFechar} aria-label="Fechar">
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">O que é *</Label>
            <Input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex.: Equipamentos obra Marina"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Valor (R$) *</Label>
              <Input
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                inputMode="decimal"
                placeholder="0,00"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Vencimento</Label>
              <Input
                type="date"
                value={vencimento}
                onChange={(e) => setVencimento(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Obra</Label>
            <select
              value={obra}
              onChange={(e) => setObra(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">—</option>
              {obras.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Fornecedor</Label>
            <select
              value={fornecedor}
              onChange={(e) => setFornecedor(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">—</option>
              {fornecedores.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Categoria</Label>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="equipamento">Equipamento</option>
              <option value="terceiros">Terceiros</option>
              <option value="imposto">Imposto</option>
              <option value="folha">Folha</option>
              <option value="estrutura">Estrutura</option>
              <option value="outro">Outro</option>
            </select>
          </div>
          <Button className="w-full gap-2" onClick={salvar} disabled={salvando}>
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Lançar conta
          </Button>
        </div>
      </div>
    </div>
  )
}
