/* Equipamentos: o que foi instalado, com série e garantia.

   É o registro que faltava: sem ele, quando o cliente liga com problema
   ninguém sabe quando comprou, de quem, nem se ainda está na garantia. */
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ChevronLeft, Loader2, Plus, Search, ShieldAlert, ShieldCheck, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  type Cliente,
  type Equipamento,
  type Fornecedor,
  ROTULO_EQUIP,
  atualizarEquipamento,
  calcularGarantia,
  criarEquipamento,
  listarClientes,
  listarEquipamentos,
  listarFornecedores,
  situacaoGarantia,
} from '@/services/ciclo'
import { listarObras } from '@/services/acesso'

type Props = { onVoltar: () => void }

const dataBR = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—'

export default function Equipamentos({ onVoltar }: Props) {
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [obras, setObras] = useState<{ id: string; nome: string }[]>([])
  const [carregando, setCarregando] = useState(true)
  const [novo, setNovo] = useState(false)
  const [busca, setBusca] = useState('')

  async function carregar() {
    try {
      const [eq, cl, fo, ob] = await Promise.all([
        listarEquipamentos(),
        listarClientes(),
        listarFornecedores(),
        listarObras(),
      ])
      setEquipamentos(eq)
      setClientes(cl)
      setFornecedores(fo)
      setObras(ob)
    } catch {
      toast.error('Não foi possível carregar os equipamentos')
    }
    setCarregando(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  const filtrados = equipamentos.filter((e) => {
    if (!busca.trim()) return true
    const alvo =
      `${e.nome} ${e.marca ?? ''} ${e.modelo ?? ''} ${e.numero_serie ?? ''} ${e.expand?.cliente?.nome ?? ''}`.toLowerCase()
    return alvo.includes(busca.toLowerCase())
  })

  const vencidas = equipamentos.filter((e) => situacaoGarantia(e) === 'vencida').length
  const vencendo = equipamentos.filter((e) => situacaoGarantia(e) === 'vencendo').length

  async function renovarGarantia(eq: Equipamento) {
    const meses = prompt(`Quantos meses de garantia para "${eq.nome}"?`, '12')
    if (!meses) return
    const n = parseInt(meses, 10)
    if (Number.isNaN(n) || n <= 0) {
      toast.error('Informe um número de meses')
      return
    }
    const base = eq.data_compra ?? new Date().toISOString()
    const ate = calcularGarantia(base, n)
    try {
      await atualizarEquipamento(eq.id, { garantia_meses: n, garantia_ate: ate })
      await carregar()
      toast.success('Garantia atualizada')
    } catch {
      toast.error('Não foi possível atualizar')
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
            <h1 className="text-lg font-semibold">Equipamentos</h1>
          </div>
          <Button size="sm" className="gap-1" onClick={() => setNovo(true)}>
            <Plus className="h-4 w-4" /> Novo
          </Button>
        </div>

        {vencendo > 0 && (
          <div className="mx-auto mt-2 flex max-w-2xl items-center gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            {vencendo} garantia(s) vencem em até 30 dias
          </div>
        )}
      </header>

      <main className="mx-auto max-w-2xl space-y-3 px-4 py-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, série ou cliente"
            className="pl-9"
          />
        </div>

        <p className="text-xs text-muted-foreground">
          {equipamentos.length} equipamento(s) · {vencidas} com garantia vencida
        </p>

        {carregando && (
          <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>
        )}

        {!carregando && filtrados.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              {equipamentos.length === 0
                ? 'Nenhum equipamento cadastrado. Comece pelo que você instalou na última obra: marca, modelo e número de série.'
                : 'Nenhum equipamento encontrado para esta busca.'}
            </CardContent>
          </Card>
        )}

        {filtrados.map((eq) => {
          const g = situacaoGarantia(eq)
          return (
            <Card key={eq.id}>
              <CardContent className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">
                      {[eq.marca, eq.modelo, eq.nome].filter(Boolean).join(' ')}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {eq.expand?.cliente?.nome ?? 'sem cliente'}
                      {eq.expand?.obra?.nome ? ` · ${eq.expand.obra.nome}` : ''}
                    </p>
                    {eq.numero_serie && (
                      <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                        Série {eq.numero_serie}
                      </p>
                    )}
                  </div>
                  <Badge variant="secondary" className="shrink-0 text-xs">
                    {ROTULO_EQUIP[eq.status ?? 'instalado'] ?? eq.status}
                  </Badge>
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t pt-2">
                  {g === 'vencida' && (
                    <span className="flex items-center gap-1 text-xs font-medium text-destructive">
                      <ShieldAlert className="h-3.5 w-3.5" /> Garantia vencida (
                      {dataBR(eq.garantia_ate)})
                    </span>
                  )}
                  {g === 'vencendo' && (
                    <span className="flex items-center gap-1 text-xs font-medium text-amber-700">
                      <ShieldAlert className="h-3.5 w-3.5" /> Vence em {dataBR(eq.garantia_ate)}
                    </span>
                  )}
                  {g === 'ok' && (
                    <span className="flex items-center gap-1 text-xs text-emerald-700">
                      <ShieldCheck className="h-3.5 w-3.5" /> Em garantia até{' '}
                      {dataBR(eq.garantia_ate)}
                    </span>
                  )}
                  {g === 'sem_dado' && (
                    <span className="text-xs text-muted-foreground">Garantia não informada</span>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto h-7 px-2 text-xs"
                    onClick={() => renovarGarantia(eq)}
                  >
                    Definir garantia
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </main>

      {novo && (
        <FormEquipamento
          clientes={clientes}
          fornecedores={fornecedores}
          obras={obras}
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

function FormEquipamento({
  clientes,
  fornecedores,
  obras,
  onFechar,
  onSalvo,
}: {
  clientes: Cliente[]
  fornecedores: Fornecedor[]
  obras: { id: string; nome: string }[]
  onFechar: () => void
  onSalvo: () => void
}) {
  const [nome, setNome] = useState('')
  const [marca, setMarca] = useState('')
  const [modelo, setModelo] = useState('')
  const [serie, setSerie] = useState('')
  const [cliente, setCliente] = useState('')
  const [obra, setObra] = useState('')
  const [fornecedor, setFornecedor] = useState('')
  const [dataCompra, setDataCompra] = useState('')
  const [meses, setMeses] = useState('12')
  const [valor, setValor] = useState('')
  const [local, setLocal] = useState('')
  const [obs, setObs] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    if (!nome.trim()) {
      toast.error('Diga o que é o equipamento')
      return
    }
    setSalvando(true)
    try {
      const ate = calcularGarantia(
        dataCompra ? new Date(dataCompra + 'T12:00:00').toISOString() : undefined,
        meses ? parseInt(meses, 10) : undefined,
      )
      const limpo = valor
        .replace(/[^\d,.-]/g, '')
        .replace(/\./g, '')
        .replace(',', '.')
      const v = parseFloat(limpo)

      await criarEquipamento({
        nome: nome.trim(),
        marca: marca.trim(),
        modelo: modelo.trim(),
        numero_serie: serie.trim(),
        cliente: cliente || undefined,
        obra: obra || undefined,
        fornecedor: fornecedor || undefined,
        data_compra: dataCompra ? new Date(dataCompra + 'T12:00:00').toISOString() : undefined,
        garantia_meses: meses ? parseInt(meses, 10) : undefined,
        garantia_ate: ate ?? undefined,
        valor_compra: Number.isNaN(v) ? undefined : v,
        local_instalacao: local.trim(),
        observacoes: obs.trim(),
        status: obra || cliente ? 'instalado' : 'em_estoque',
      })
      toast.success('Equipamento cadastrado')
      onSalvo()
    } catch (e) {
      toast.error('Não foi possível cadastrar', { description: String(e) })
    }
    setSalvando(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40 sm:items-center sm:justify-center">
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-background p-4 shadow-lg sm:max-w-md sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Novo equipamento</h2>
          <Button variant="ghost" size="icon" onClick={onFechar} aria-label="Fechar">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Equipamento *</Label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Amplificador multizona"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Marca</Label>
              <Input
                value={marca}
                onChange={(e) => setMarca(e.target.value)}
                placeholder="Ex.: Control4"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Modelo</Label>
              <Input
                value={modelo}
                onChange={(e) => setModelo(e.target.value)}
                placeholder="Ex.: C4-EA5"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Número de série</Label>
            <Input
              value={serie}
              onChange={(e) => setSerie(e.target.value)}
              placeholder="Como está na etiqueta"
              className="font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Cliente</Label>
            <select
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">—</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
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

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Data da compra</Label>
              <Input
                type="date"
                value={dataCompra}
                onChange={(e) => setDataCompra(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Garantia (meses)</Label>
              <Input
                value={meses}
                onChange={(e) => setMeses(e.target.value)}
                inputMode="numeric"
                placeholder="12"
              />
            </div>
          </div>

          {dataCompra && meses && (
            <p className="text-[11px] text-muted-foreground">
              Garantia até{' '}
              {dataBR(
                calcularGarantia(
                  new Date(dataCompra + 'T12:00:00').toISOString(),
                  parseInt(meses, 10),
                ) ?? undefined,
              )}
            </p>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Valor da compra (R$)</Label>
            <Input
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              inputMode="decimal"
              placeholder="Ex.: 4500"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Onde está instalado</Label>
            <Input
              value={local}
              onChange={(e) => setLocal(e.target.value)}
              placeholder="Ex.: Rack da sala técnica"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Observações</Label>
            <Textarea
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              rows={2}
              placeholder="Ex.: IP fixo 10.0.0.42"
            />
          </div>

          <Button className="w-full gap-2" onClick={salvar} disabled={salvando}>
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Cadastrar equipamento
          </Button>
        </div>
      </div>
    </div>
  )
}
