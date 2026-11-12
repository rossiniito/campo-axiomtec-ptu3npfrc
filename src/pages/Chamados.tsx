/* Chamados: o cliente ligou, o que aconteceu e quem resolveu.

   Antes isso vivia no WhatsApp. Aqui o chamado nasce ligado ao cliente e,
   quando é o caso, ao equipamento — o que mostra na hora se está na garantia. */
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ChevronLeft, Loader2, Plus, Wrench, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  type Chamado,
  type Cliente,
  type Equipamento,
  ROTULO_CHAMADO,
  ROTULO_PRIORIDADE,
  ROTULO_TIPO_CHAMADO,
  atualizarChamado,
  criarChamado,
  listarChamados,
  listarClientes,
  listarEquipamentos,
  proximoNumeroChamado,
} from '@/services/ciclo'

type Props = { onVoltar: () => void }

const dataBR = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—'

export default function Chamados({ onVoltar }: Props) {
  const [chamados, setChamados] = useState<Chamado[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([])
  const [carregando, setCarregando] = useState(true)
  const [novo, setNovo] = useState(false)

  async function carregar() {
    try {
      const [ch, cl, eq] = await Promise.all([
        listarChamados(),
        listarClientes(),
        listarEquipamentos(),
      ])
      setChamados(ch)
      setClientes(cl)
      setEquipamentos(eq)
    } catch {
      toast.error('Não foi possível carregar os chamados')
    }
    setCarregando(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  const abertos = chamados.filter((c) =>
    ['aberto', 'agendado', 'em_andamento'].includes(c.status ?? 'aberto'),
  )
  const fechados = chamados.filter((c) => ['resolvido', 'cancelado'].includes(c.status ?? ''))

  async function mudarStatus(c: Chamado, status: string) {
    try {
      const dados: Record<string, unknown> = { status }
      if (status === 'resolvido') dados.fechado_em = new Date().toISOString()
      await atualizarChamado(c.id, dados)
      await carregar()
      toast.success('Chamado atualizado')
    } catch (e) {
      toast.error('Não foi possível atualizar', { description: String(e) })
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
              AxiomTec · Pós-venda
            </p>
            <h1 className="text-lg font-semibold">Chamados</h1>
          </div>
          <Button size="sm" className="gap-1" onClick={() => setNovo(true)}>
            <Plus className="h-4 w-4" /> Novo
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-3 px-4 py-4">
        {carregando && (
          <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>
        )}

        {!carregando && chamados.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              Nenhum chamado ainda. Quando o cliente ligar com problema, registre aqui: fica o
              histórico de quem atendeu e se estava na garantia.
            </CardContent>
          </Card>
        )}

        {abertos.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Em aberto ({abertos.length})</h2>
            {abertos.map((c) => (
              <Card key={c.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {c.numero} · {dataBR(c.aberto_em ?? c.created)}
                      </p>
                      <p className="truncate font-semibold">{c.titulo}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.expand?.cliente?.nome ?? '—'}
                        {c.expand?.equipamento ? ` · ${c.expand.equipamento.nome}` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge variant="secondary" className="text-xs">
                        {ROTULO_CHAMADO[c.status ?? 'aberto']}
                      </Badge>
                      {c.prioridade === 'urgente' && (
                        <Badge variant="destructive" className="text-xs">
                          Urgente
                        </Badge>
                      )}
                      {c.coberto_garantia && (
                        <Badge variant="outline" className="text-xs">
                          Garantia
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 border-t pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 text-xs"
                      onClick={() => mudarStatus(c, 'em_andamento')}
                    >
                      <Wrench className="h-3 w-3" /> Atender
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 gap-1 text-xs"
                      onClick={() => mudarStatus(c, 'resolvido')}
                    >
                      Resolver
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </section>
        )}

        {fechados.length > 0 && (
          <section className="space-y-2 pt-2">
            <h2 className="text-sm font-semibold">Resolvidos ({fechados.length})</h2>
            {fechados.slice(0, 10).map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-2 rounded-lg border bg-card p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{c.titulo}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.numero} · {c.expand?.cliente?.nome ?? '—'} · fechado {dataBR(c.fechado_em)}
                  </p>
                </div>
                <Badge variant="outline" className="shrink-0 text-xs">
                  {ROTULO_CHAMADO[c.status ?? 'resolvido']}
                </Badge>
              </div>
            ))}
          </section>
        )}
      </main>

      {novo && (
        <FormChamado
          clientes={clientes}
          equipamentos={equipamentos}
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

function FormChamado({
  clientes,
  equipamentos,
  onFechar,
  onSalvo,
}: {
  clientes: Cliente[]
  equipamentos: Equipamento[]
  onFechar: () => void
  onSalvo: () => void
}) {
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [cliente, setCliente] = useState('')
  const [equipamento, setEquipamento] = useState('')
  const [tipo, setTipo] = useState('corretiva')
  const [prioridade, setPrioridade] = useState('normal')
  const [garantia, setGarantia] = useState(false)
  const [salvando, setSalvando] = useState(false)

  const doCliente = equipamentos.filter((e) => !cliente || e.cliente === cliente)

  async function salvar() {
    if (!titulo.trim() || !cliente) {
      toast.error('Informe o cliente e o que aconteceu')
      return
    }
    setSalvando(true)
    try {
      const numero = await proximoNumeroChamado()
      await criarChamado({
        numero,
        titulo: titulo.trim(),
        descricao: descricao.trim(),
        cliente,
        equipamento: equipamento || undefined,
        tipo,
        prioridade,
        status: 'aberto',
        aberto_em: new Date().toISOString(),
        coberto_garantia: garantia,
      })
      toast.success(`${numero} aberto`)
      onSalvo()
    } catch (e) {
      toast.error('Não foi possível abrir o chamado', { description: String(e) })
    }
    setSalvando(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40 sm:items-center sm:justify-center">
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-background p-4 shadow-lg sm:max-w-md sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Novo chamado</h2>
          <Button variant="ghost" size="icon" onClick={onFechar} aria-label="Fechar">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Cliente *</Label>
            <select
              value={cliente}
              onChange={(e) => {
                setCliente(e.target.value)
                setEquipamento('')
              }}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Escolha o cliente</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">O que aconteceu *</Label>
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: Sala de cinema sem som"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Equipamento (se souber)</Label>
            <select
              value={equipamento}
              onChange={(e) => setEquipamento(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">—</option>
              {doCliente.map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {[eq.marca, eq.modelo, eq.nome].filter(Boolean).join(' ')}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo</Label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {Object.entries(ROTULO_TIPO_CHAMADO).map(([v, r]) => (
                  <option key={v} value={v}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Prioridade</Label>
              <select
                value={prioridade}
                onChange={(e) => setPrioridade(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {Object.entries(ROTULO_PRIORIDADE).map(([v, r]) => (
                  <option key={v} value={v}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={garantia}
              onChange={(e) => setGarantia(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            Coberto pela garantia
          </label>

          <div className="space-y-1.5">
            <Label className="text-xs">Detalhes</Label>
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={3}
              placeholder="O que o cliente relatou, o que já foi testado"
            />
          </div>

          <Button className="w-full gap-2" onClick={salvar} disabled={salvando}>
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Abrir chamado
          </Button>
        </div>
      </div>
    </div>
  )
}
