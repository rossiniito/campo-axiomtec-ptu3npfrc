/* Despesas de campo: o técnico lança do celular, o gestor aprova.

   Fricção mínima de propósito: valor, tipo e foto do comprovante. Se pedir
   muita coisa, ele não lança, e sem o lançamento a margem por obra morre. */
import { useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Camera, Check, ChevronLeft, Loader2, Plus, Wallet, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  type Despesa,
  ROTULO_DESPESA,
  ROTULO_STATUS_DESPESA,
  aprovarDespesa,
  brl,
  criarDespesa,
  listarDespesas,
  listarMinhasDespesas,
  marcarReembolsada,
  recusarDespesa,
  totalAReembolsar,
} from '@/services/financeiro'
import { listarObras } from '@/services/acesso'

type Props = { onVoltar: () => void; usuarioId: string; ehGestor: boolean }

const dataBR = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—'

export default function Despesas({ onVoltar, usuarioId, ehGestor }: Props) {
  const [despesas, setDespesas] = useState<Despesa[]>([])
  const [obras, setObras] = useState<{ id: string; nome: string }[]>([])
  const [carregando, setCarregando] = useState(true)
  const [novo, setNovo] = useState(false)
  const [aba, setAba] = useState<'todas' | 'pendentes'>('pendentes')

  async function carregar() {
    try {
      const [d, o] = await Promise.all([
        ehGestor ? listarDespesas() : listarMinhasDespesas(usuarioId),
        listarObras(),
      ])
      setDespesas(d)
      setObras(o)
    } catch {
      toast.error('Não foi possível carregar as despesas')
    }
    setCarregando(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  const pendentes = despesas.filter((d) => d.status === 'pendente')
  const lista = aba === 'pendentes' ? pendentes : despesas
  const aPagar = useMemo(() => totalAReembolsar(despesas), [despesas])
  const mesAtual = new Date().getMonth()
  const gastoMes = despesas
    .filter((d) => {
      if (d.status === 'recusado') return false
      const dt = d.data ? new Date(d.data) : null
      return dt && dt.getMonth() === mesAtual
    })
    .reduce((s, d) => s + (d.valor ?? 0), 0)

  async function aprovar(d: Despesa) {
    try {
      await aprovarDespesa(d.id, usuarioId)
      await carregar()
      toast.success('Despesa aprovada')
    } catch {
      toast.error('Não foi possível aprovar')
    }
  }

  async function recusar(d: Despesa) {
    const motivo = prompt(`Motivo para recusar "${d.descricao}"?`)
    if (!motivo) return
    try {
      await recusarDespesa(d.id, usuarioId, motivo)
      await carregar()
      toast.success('Despesa recusada')
    } catch {
      toast.error('Não foi possível recusar')
    }
  }

  async function reembolsar(d: Despesa) {
    try {
      await marcarReembolsada(d.id)
      await carregar()
      toast.success('Marcada como reembolsada')
    } catch {
      toast.error('Não foi possível marcar')
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
              AxiomTec · Campo
            </p>
            <h1 className="text-lg font-semibold">Despesas</h1>
          </div>
          <Button size="sm" className="gap-1" onClick={() => setNovo(true)}>
            <Plus className="h-4 w-4" /> Lançar
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-3 px-4 py-4">
        <div className="grid grid-cols-2 gap-2">
          <Card>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">A reembolsar</p>
              <p className="text-lg font-semibold">{brl(aPagar)}</p>
              <p className="text-[11px] text-muted-foreground">aprovadas, não pagas</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Gasto neste mês</p>
              <p className="text-lg font-semibold">{brl(gastoMes)}</p>
              <p className="text-[11px] text-muted-foreground">entra na margem da obra</p>
            </CardContent>
          </Card>
        </div>

        {ehGestor && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={aba === 'pendentes' ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => setAba('pendentes')}
            >
              A aprovar ({pendentes.length})
            </Button>
            <Button
              size="sm"
              variant={aba === 'todas' ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => setAba('todas')}
            >
              Todas ({despesas.length})
            </Button>
          </div>
        )}

        {carregando && (
          <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>
        )}

        {!carregando && lista.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-2 p-6 text-center text-sm text-muted-foreground">
              <Wallet className="h-6 w-6" />
              {aba === 'pendentes'
                ? 'Nenhuma despesa aguardando aprovação.'
                : 'Nenhuma despesa lançada ainda. Toque em "Lançar" no posto, no restaurante, em qualquer lugar.'}
            </CardContent>
          </Card>
        )}

        {lista.map((d) => (
          <Card key={d.id}>
            <CardContent className="space-y-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{d.descricao}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {ROTULO_DESPESA[d.tipo ?? 'outro']} · {dataBR(d.data ?? d.created)}
                    {d.expand?.obra?.nome ? ` · ${d.expand.obra.nome}` : ''}
                  </p>
                  {ehGestor && d.expand?.tecnico && (
                    <p className="truncate text-[11px] text-muted-foreground">
                      {d.expand.tecnico.name || d.expand.tecnico.email}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-semibold">{brl(d.valor ?? 0)}</p>
                  <Badge
                    variant={d.status === 'pendente' ? 'secondary' : 'outline'}
                    className="mt-1 text-[10px]"
                  >
                    {ROTULO_STATUS_DESPESA[d.status ?? 'pendente']}
                  </Badge>
                </div>
              </div>

              {d.motivo_recusa && (
                <p className="rounded bg-destructive/10 px-2 py-1 text-xs text-destructive">
                  Recusada: {d.motivo_recusa}
                </p>
              )}

              {d.comprovante && d.comprovante.length > 0 && (
                <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Camera className="h-3 w-3" /> {d.comprovante.length} comprovante(s)
                </p>
              )}

              {ehGestor && d.status === 'pendente' && (
                <div className="flex gap-2 border-t pt-2">
                  <Button size="sm" className="h-7 flex-1 gap-1 text-xs" onClick={() => aprovar(d)}>
                    <Check className="h-3 w-3" /> Aprovar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 flex-1 gap-1 text-xs"
                    onClick={() => recusar(d)}
                  >
                    <X className="h-3 w-3" /> Recusar
                  </Button>
                </div>
              )}

              {ehGestor && d.status === 'aprovado' && (
                <div className="border-t pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 w-full text-xs"
                    onClick={() => reembolsar(d)}
                  >
                    Marcar como reembolsada
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </main>

      {novo && (
        <FormDespesa
          obras={obras}
          usuarioId={usuarioId}
          onFechar={() => setNovo(false)}
          onSalvo={async () => {
            setNovo(false)
            await carregar()
          }}
        />
      )}
    </div>
  )
}

function FormDespesa({
  obras,
  usuarioId,
  onFechar,
  onSalvo,
}: {
  obras: { id: string; nome: string }[]
  usuarioId: string
  onFechar: () => void
  onSalvo: () => void
}) {
  const [descricao, setDescricao] = useState('')
  const [tipo, setTipo] = useState('combustivel')
  const [valor, setValor] = useState('')
  const [data, setData] = useState(new Date().toISOString().slice(0, 10))
  const [obra, setObra] = useState('')
  const [obs, setObs] = useState('')
  const [arquivos, setArquivos] = useState<File[]>([])
  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    const limpo = valor
      .replace(/[^\d,.-]/g, '')
      .replace(/\./g, '')
      .replace(',', '.')
    const v = parseFloat(limpo)
    if (!descricao.trim() || Number.isNaN(v) || v <= 0) {
      toast.error('Informe o que foi e quanto custou')
      return
    }
    if (!obra) {
      toast.error('Escolha a obra — sem ela a despesa não entra na margem')
      return
    }
    setSalvando(true)
    try {
      const form = new FormData()
      form.append('descricao', descricao.trim())
      form.append('tipo', tipo)
      form.append('valor', String(v))
      form.append('data', new Date(data + 'T12:00:00').toISOString())
      form.append('obra', obra)
      form.append('tecnico', usuarioId)
      form.append('observacoes', obs.trim())
      form.append('status', 'pendente')
      arquivos.forEach((f) => form.append('comprovante', f))
      await criarDespesa(form as unknown as Record<string, unknown>)
      toast.success('Despesa lançada')
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
          <h2 className="text-lg font-semibold">Nova despesa</h2>
          <Button variant="ghost" size="icon" onClick={onFechar} aria-label="Fechar">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">O que foi *</Label>
            <Input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex.: Gasolina ida Alphaville"
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
                className="text-lg"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Data</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Tipo</Label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {Object.entries(ROTULO_DESPESA).map(([v, r]) => (
                <option key={v} value={v}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Obra *</Label>
            <select
              value={obra}
              onChange={(e) => setObra(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Escolha a obra</option>
              {obras.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Foto do comprovante</Label>
            <Input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setArquivos(Array.from(e.target.files ?? []))}
              className="text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              Tire a foto na hora — evita perder o cupom e acelera a aprovação.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Observações</Label>
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} />
          </div>

          <Button className="w-full gap-2" onClick={salvar} disabled={salvando}>
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Lançar despesa
          </Button>
        </div>
      </div>
    </div>
  )
}
