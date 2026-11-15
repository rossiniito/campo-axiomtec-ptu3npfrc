/* Contas PJ: onde o dinheiro da empresa está, e se falta aporte.

   Só PJ, por decisão do Rossini (15/11/2026): PF não entra no sistema, para
   não misturar. O dinheiro de terceiro (RealHT) aparece separado porque, se
   somar com o resto, parece caixa livre e o dono gasta o que não é dele. */
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertTriangle, Banknote, Check, ChevronLeft, CreditCard, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  type Aporte,
  type ConfigFinanceiro,
  type Conta,
  type SituacaoCaixa,
  ROTULO_TIPO_CONTA,
  avaliarAporte,
  brl2,
  carregarConfig,
  caixaDeTerceiro,
  caixaProprio,
  criarAporte,
  faturasAbertas,
  listarAportes,
  listarContas,
  salvarConta,
} from '@/services/contas'
import { listarPagamentos, listarRecebimentos, projetarCaixa } from '@/services/recebimento'

type Props = { onVoltar: () => void }

const dataBR = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—'

export default function Contas({ onVoltar }: Props) {
  const [contas, setContas] = useState<Conta[]>([])
  const [aportes, setAportes] = useState<Aporte[]>([])
  const [config, setConfig] = useState<ConfigFinanceiro | null>(null)
  const [situacao, setSituacao] = useState<SituacaoCaixa | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [editando, setEditando] = useState<Conta | null>(null)
  const [pedindoAporte, setPedindoAporte] = useState(false)

  async function carregar() {
    try {
      const [cs, ap, cf, rec, pag] = await Promise.all([
        listarContas(),
        listarAportes(),
        carregarConfig(),
        listarRecebimentos(),
        listarPagamentos(),
      ])
      setContas(cs)
      setAportes(ap)
      setConfig(cf)

      const proj = projetarCaixa(rec, pag)
      const j30 = proj.janelas[0]
      setSituacao(avaliarAporte(cs, cf, j30.receber, j30.pagar))
    } catch {
      toast.error('Não foi possível carregar as contas')
    }
    setCarregando(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  const proprio = caixaProprio(contas)
  const terceiro = caixaDeTerceiro(contas)
  const faturas = faturasAbertas(contas)

  async function salvarSaldo(c: Conta) {
    const v = prompt(`Saldo atual de "${c.nome}" (R$)`, String(c.saldo ?? 0))
    if (v === null) return
    const valor = parseFloat(v.replace(/\./g, '').replace(',', '.'))
    if (Number.isNaN(valor)) {
      toast.error('Valor inválido')
      return
    }
    try {
      await salvarConta(c.id, { saldo: valor, saldo_em: new Date().toISOString() })
      await carregar()
      toast.success('Saldo atualizado')
    } catch {
      toast.error('Não foi possível salvar')
    }
  }

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
            <h1 className="text-lg font-semibold">Contas PJ</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-3 px-4 py-4">
        {carregando && (
          <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>
        )}

        {/* ALERTA DE APORTE — o topo é o lugar certo: é o que ele pediu */}
        {!carregando && situacao?.precisaAporte && (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardContent className="space-y-2 p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                <div className="min-w-0">
                  <p className="font-semibold text-destructive">Precisa de aporte</p>
                  <p className="text-sm text-destructive/90">{situacao.motivo}</p>
                </div>
              </div>
              <p className="text-2xl font-semibold">{brl2(situacao.falta)}</p>
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => setPedindoAporte(true)}
              >
                Registrar pedido de aporte
              </Button>
            </CardContent>
          </Card>
        )}

        {!carregando && situacao && !situacao.precisaAporte && (
          <Card className="border-emerald-200 bg-emerald-50">
            <CardContent className="flex items-center gap-2 p-3">
              <Check className="h-4 w-4 text-emerald-700" />
              <p className="text-sm text-emerald-800">{situacao.motivo}</p>
            </CardContent>
          </Card>
        )}

        {!carregando && (
          <>
            <Card>
              <CardContent className="space-y-1 p-4">
                <p className="text-xs text-muted-foreground">Caixa próprio (PJ)</p>
                <p className="text-3xl font-semibold">{brl2(proprio)}</p>
                {terceiro > 0 && (
                  <p className="text-[11px] text-amber-700">
                    + {brl2(terceiro)} de terceiro (RealHT) que não é seu e vai sair
                  </p>
                )}
                {config?.piso_caixa ? (
                  <p className="text-[11px] text-muted-foreground">
                    Piso de reserva: {brl2(config.piso_caixa)} (2 meses de custo fixo)
                  </p>
                ) : null}
                {situacao && (
                  <div className="grid grid-cols-2 gap-2 border-t pt-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Entra em 30 dias</p>
                      <p className="font-medium text-emerald-700">{brl2(situacao.entra30)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Sai em 30 dias</p>
                      <p className="font-medium text-destructive">{brl2(situacao.sai30)}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {faturas.total > 0 && (
              <Card className="border-amber-200">
                <CardContent className="space-y-1 p-3">
                  <p className="flex items-center gap-1 text-xs font-medium text-amber-800">
                    <CreditCard className="h-3.5 w-3.5" /> Faturas de cartão PJ em aberto
                  </p>
                  <p className="text-lg font-semibold">{brl2(faturas.total)}</p>
                  {faturas.itens.map((c) => (
                    <p key={c.id} className="text-[11px] text-muted-foreground">
                      {c.banco ?? c.nome}: {brl2(c.fatura_aberta ?? 0)}
                      {c.fatura_venc ? ` · vence ${dataBR(c.fatura_venc)}` : ''}
                    </p>
                  ))}
                </CardContent>
              </Card>
            )}

            <h2 className="pt-1 text-sm font-semibold">{contas.length} conta(s) PJ</h2>

            {contas.length === 0 && (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center gap-2 p-6 text-center text-sm text-muted-foreground">
                  <Banknote className="h-6 w-6" />
                  Nenhuma conta cadastrada ainda. Assim que o levantamento das contas PJ chegar,
                  elas entram aqui com saldo e finalidade.
                </CardContent>
              </Card>
            )}

            {contas.map((c) => (
              <Card key={c.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{c.nome}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {ROTULO_TIPO_CONTA[c.tipo ?? 'corrente']}
                        {c.finalidade ? ` · ${c.finalidade}` : ''}
                      </p>
                      {c.saldo_em && (
                        <p className="text-[11px] text-muted-foreground">
                          saldo de {dataBR(c.saldo_em)}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-semibold">{brl2(c.saldo ?? 0)}</p>
                      {(c.valor_terceiro ?? 0) > 0 && (
                        <Badge variant="outline" className="mt-1 text-[10px] text-amber-700">
                          {brl2(c.valor_terceiro ?? 0)} de terceiro
                        </Badge>
                      )}
                    </div>
                  </div>

                  {c.tem_cartao && (
                    <p className="flex items-center gap-1 border-t pt-2 text-[11px] text-muted-foreground">
                      <CreditCard className="h-3 w-3" />
                      Cartão
                      {c.limite_cartao ? ` · limite ${brl2(c.limite_cartao)}` : ''}
                      {c.fatura_aberta ? ` · fatura ${brl2(c.fatura_aberta)}` : ''}
                    </p>
                  )}

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 flex-1 text-xs"
                      onClick={() => salvarSaldo(c)}
                    >
                      Atualizar saldo
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() => setEditando(c)}
                    >
                      Editar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            {aportes.length > 0 && (
              <>
                <h2 className="pt-2 text-sm font-semibold">Aportes</h2>
                {aportes.slice(0, 5).map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between gap-2 rounded-lg border bg-card p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {a.motivo || 'Aporte de sócio'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {dataBR(a.data)}
                        {a.expand?.conta?.nome ? ` · ${a.expand.conta.nome}` : ''}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold">{brl2(a.valor)}</p>
                      <Badge variant="outline" className="text-[10px]">
                        {a.status === 'pendente'
                          ? 'pendente'
                          : a.status === 'feito'
                            ? 'feito'
                            : 'cancelado'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </>
            )}

            <p className="px-1 pt-2 text-[11px] leading-relaxed text-muted-foreground">
              Só contas PJ entram aqui — pessoa física fica fora, por decisão sua. A regra do aporte
              compara: caixa próprio + o que entra em 30 dias − o que sai em 30 dias contra o piso
              de reserva. Fatura de cartão aparece como informação e fica fora da conta, porque já
              está lançada como conta a pagar.
            </p>
          </>
        )}
      </main>

      {editando && (
        <FormConta
          conta={editando}
          onFechar={() => setEditando(null)}
          onSalvo={async () => {
            setEditando(null)
            await carregar()
          }}
        />
      )}

      {pedindoAporte && situacao && (
        <FormAporte
          valorSugerido={situacao.falta}
          motivoSugerido={situacao.motivo}
          contas={contas}
          onFechar={() => setPedindoAporte(false)}
          onSalvo={async () => {
            setPedindoAporte(false)
            await carregar()
          }}
        />
      )}
    </div>
  )
}

function FormConta({
  conta,
  onFechar,
  onSalvo,
}: {
  conta: Conta
  onFechar: () => void
  onSalvo: () => void
}) {
  const [finalidade, setFinalidade] = useState(conta.finalidade ?? '')
  const [tipo, setTipo] = useState(conta.tipo ?? 'corrente')
  const [saldo, setSaldo] = useState(String(conta.saldo ?? ''))
  const [terceiro, setTerceiro] = useState(String(conta.valor_terceiro ?? ''))
  const [fatura, setFatura] = useState(String(conta.fatura_aberta ?? ''))
  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    setSalvando(true)
    try {
      const num = (s: string) => {
        const n = parseFloat(s.replace(/\./g, '').replace(',', '.'))
        return Number.isNaN(n) ? 0 : n
      }
      await salvarConta(conta.id, {
        finalidade: finalidade.trim(),
        tipo,
        saldo: num(saldo),
        valor_terceiro: num(terceiro),
        fatura_aberta: num(fatura),
        saldo_em: new Date().toISOString(),
      })
      toast.success('Conta atualizada')
      onSalvo()
    } catch (e) {
      toast.error('Não foi possível salvar', { description: String(e) })
    }
    setSalvando(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40 sm:items-center sm:justify-center">
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-background p-4 shadow-lg sm:max-w-md sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">{conta.nome}</h2>
          <Button variant="ghost" size="icon" onClick={onFechar} aria-label="Fechar">
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo</Label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as Conta['tipo'])}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {Object.entries(ROTULO_TIPO_CONTA).map(([v, r]) => (
                <option key={v} value={v}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Para que serve</Label>
            <Input
              value={finalidade}
              onChange={(e) => setFinalidade(e.target.value)}
              placeholder="Ex.: recebe quase tudo"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Saldo (R$)</Label>
            <Input value={saldo} onChange={(e) => setSaldo(e.target.value)} inputMode="decimal" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Desse saldo, quanto é de terceiro</Label>
            <Input
              value={terceiro}
              onChange={(e) => setTerceiro(e.target.value)}
              inputMode="decimal"
            />
            <p className="text-[11px] text-muted-foreground">
              Ex.: valor da RealHT que está na conta e vai ser devolvido.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Fatura do cartão em aberto (R$)</Label>
            <Input value={fatura} onChange={(e) => setFatura(e.target.value)} inputMode="decimal" />
          </div>
          <Button className="w-full gap-2" onClick={salvar} disabled={salvando}>
            {salvando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Salvar
          </Button>
        </div>
      </div>
    </div>
  )
}

function FormAporte({
  valorSugerido,
  motivoSugerido,
  contas,
  onFechar,
  onSalvo,
}: {
  valorSugerido: number
  motivoSugerido: string
  contas: Conta[]
  onFechar: () => void
  onSalvo: () => void
}) {
  const [valor, setValor] = useState(String(Math.ceil(valorSugerido)))
  const [motivo, setMotivo] = useState(motivoSugerido)
  const [conta, setConta] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    const v = parseFloat(valor.replace(/\./g, '').replace(',', '.'))
    if (Number.isNaN(v) || v <= 0) {
      toast.error('Valor inválido')
      return
    }
    setSalvando(true)
    try {
      await criarAporte({
        valor: v,
        data: new Date().toISOString(),
        motivo,
        conta: conta || undefined,
        status: 'pendente',
      })
      toast.success('Pedido de aporte registrado')
      onSalvo()
    } catch (e) {
      toast.error('Não foi possível registrar', { description: String(e) })
    }
    setSalvando(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40 sm:items-center sm:justify-center">
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-background p-4 shadow-lg sm:max-w-md sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Pedido de aporte</h2>
          <Button variant="ghost" size="icon" onClick={onFechar} aria-label="Fechar">
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Valor do aporte (R$)</Label>
            <Input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Motivo</Label>
            <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Conta que vai receber</Label>
            <select
              value={conta}
              onChange={(e) => setConta(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">—</option>
              {contas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
          <Button className="w-full gap-2" onClick={salvar} disabled={salvando}>
            {salvando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Registrar pedido
          </Button>
        </div>
      </div>
    </div>
  )
}
