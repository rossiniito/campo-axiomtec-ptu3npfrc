import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  House,
  Loader2,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  type BlocoModelo,
  type Modelo,
  ROTULO_CATEGORIA,
  atualizarModelo,
  criarModelo,
  listarModelos,
  totalDeItens,
} from '@/services/modelos'

export default function Modelos({ onSair }: { onSair?: () => void }) {
  const [modelos, setModelos] = useState<Modelo[]>([])
  const [carregando, setCarregando] = useState(true)
  const [editando, setEditando] = useState<Modelo | 'novo' | null>(null)

  async function carregar() {
    try {
      setModelos(await listarModelos())
    } catch {
      toast.error('Não foi possível carregar os modelos')
    }
    setCarregando(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  if (editando) {
    return (
      <EditorModelo
        modelo={editando === 'novo' ? null : editando}
        onVoltar={() => {
          setEditando(null)
          carregar()
        }}
        onSair={onSair}
      />
    )
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-10 border-b bg-background px-4 py-3">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onSair?.()}
            aria-label="Voltar ao menu"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              AxiomTec · Campo
            </p>
            <h1 className="text-lg font-semibold">Modelos de checklist</h1>
          </div>
          <Button size="sm" className="gap-1" onClick={() => setEditando('novo')}>
            <Plus className="h-4 w-4" /> Novo
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-3 px-4 py-4">
        <p className="text-xs text-muted-foreground">
          O modelo é aplicado numa OS que esteja sem checklist. Ele cria os itens no app e o
          checklist correspondente na tarefa do ClickUp.
        </p>

        {carregando && (
          <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>
        )}

        {!carregando && modelos.length === 0 && (
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="text-base">Nenhum modelo ainda</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Monte o primeiro modelo com os ambientes e itens do seu jeito de instalar.
            </CardContent>
          </Card>
        )}

        {modelos.map((modelo) => (
          <button
            key={modelo.id}
            onClick={() => setEditando(modelo)}
            className="w-full rounded-xl border bg-card p-4 text-left transition-colors hover:bg-accent/50"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold">{modelo.nome}</p>
                {modelo.descricao && (
                  <p className="truncate text-xs text-muted-foreground">{modelo.descricao}</p>
                )}
              </div>
              {modelo.categoria && (
                <Badge variant="secondary" className="shrink-0 text-xs">
                  {ROTULO_CATEGORIA[modelo.categoria] ?? modelo.categoria}
                </Badge>
              )}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {modelo.estrutura?.length ?? 0} ambientes · {totalDeItens(modelo.estrutura ?? [])}{' '}
              itens
            </p>
          </button>
        ))}
      </main>
    </div>
  )
}

function EditorModelo({
  modelo,
  onVoltar,
  onSair,
}: {
  modelo: Modelo | null
  onVoltar: () => void
  onSair?: () => void
}) {
  const [nome, setNome] = useState(modelo?.nome ?? '')
  const [descricao, setDescricao] = useState(modelo?.descricao ?? '')
  const [categoria, setCategoria] = useState(modelo?.categoria ?? 'automacao')
  const [estrutura, setEstrutura] = useState<BlocoModelo[]>(
    modelo?.estrutura?.length
      ? modelo.estrutura.map((b) => ({ ambiente: b.ambiente, itens: [...b.itens] }))
      : [{ ambiente: '', itens: [''] }],
  )
  const [salvando, setSalvando] = useState(false)

  function alterarAmbiente(indice: number, valor: string) {
    setEstrutura((atual) => atual.map((b, i) => (i === indice ? { ...b, ambiente: valor } : b)))
  }

  function alterarItem(ambienteIdx: number, itemIdx: number, valor: string) {
    setEstrutura((atual) =>
      atual.map((b, i) =>
        i === ambienteIdx
          ? { ...b, itens: b.itens.map((it, j) => (j === itemIdx ? valor : it)) }
          : b,
      ),
    )
  }

  function adicionarItem(ambienteIdx: number) {
    setEstrutura((atual) =>
      atual.map((b, i) => (i === ambienteIdx ? { ...b, itens: [...b.itens, ''] } : b)),
    )
  }

  function removerItem(ambienteIdx: number, itemIdx: number) {
    setEstrutura((atual) =>
      atual.map((b, i) =>
        i === ambienteIdx ? { ...b, itens: b.itens.filter((_, j) => j !== itemIdx) } : b,
      ),
    )
  }

  function adicionarAmbiente() {
    setEstrutura((atual) => [...atual, { ambiente: '', itens: [''] }])
  }

  function removerAmbiente(indice: number) {
    setEstrutura((atual) => atual.filter((_, i) => i !== indice))
  }

  function moverAmbiente(indice: number, direcao: -1 | 1) {
    setEstrutura((atual) => {
      const copia = [...atual]
      const alvo = indice + direcao
      if (alvo < 0 || alvo >= copia.length) return atual
      const tmp = copia[indice]
      copia[indice] = copia[alvo]
      copia[alvo] = tmp
      return copia
    })
  }

  async function salvar() {
    const limpa = estrutura
      .map((b) => ({
        ambiente: b.ambiente.trim(),
        itens: b.itens.map((i) => i.trim()).filter(Boolean),
      }))
      .filter((b) => b.ambiente && b.itens.length > 0)

    if (!nome.trim()) {
      toast.error('Dê um nome ao modelo')
      return
    }
    if (limpa.length === 0) {
      toast.error('O modelo precisa de pelo menos um ambiente com um item')
      return
    }

    setSalvando(true)
    try {
      if (modelo) {
        await atualizarModelo(modelo.id, {
          nome: nome.trim(),
          descricao: descricao.trim(),
          categoria,
          estrutura: limpa,
        })
        toast.success('Modelo atualizado')
      } else {
        await criarModelo({
          nome: nome.trim(),
          descricao: descricao.trim(),
          categoria,
          estrutura: limpa,
        })
        toast.success('Modelo criado')
      }
      onVoltar()
    } catch (e) {
      toast.error('Não foi possível salvar', { description: String(e) })
    }
    setSalvando(false)
  }

  const total = totalDeItens(estrutura)

  return (
    <div className="min-h-screen bg-background pb-28">
      <header className="sticky top-0 z-10 border-b bg-background px-4 py-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onVoltar} aria-label="Voltar para a lista">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold">
              {modelo ? 'Editar modelo' : 'Novo modelo'}
            </h1>
            <p className="text-xs text-muted-foreground">
              {estrutura.length} ambientes · {total} itens
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-xs"
            onClick={() => onSair?.()}
            aria-label="Voltar ao menu inicial"
          >
            <House className="h-4 w-4" /> Menu
          </Button>
          <Button size="sm" className="gap-1" onClick={salvar} disabled={salvando}>
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 py-4">
        <div className="space-y-2">
          <Input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome do modelo (ex.: Automação LifeSmart — padrão)"
          />
          <Input
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Descrição curta (opcional)"
          />
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value as typeof categoria)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {Object.entries(ROTULO_CATEGORIA).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </select>
        </div>

        {estrutura.map((bloco, ambienteIdx) => (
          <Card key={ambienteIdx}>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-1">
                <Input
                  value={bloco.ambiente}
                  onChange={(e) => alterarAmbiente(ambienteIdx, e.target.value)}
                  placeholder="Ambiente (ex.: Suíte Master)"
                  className="h-9 flex-1 font-semibold"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => moverAmbiente(ambienteIdx, -1)}
                  aria-label="Subir ambiente"
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => moverAmbiente(ambienteIdx, 1)}
                  aria-label="Descer ambiente"
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-destructive"
                  onClick={() => removerAmbiente(ambienteIdx)}
                  aria-label="Remover ambiente"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {bloco.itens.map((item, itemIdx) => (
                <div key={itemIdx} className="flex items-center gap-1">
                  <Input
                    value={item}
                    onChange={(e) => alterarItem(ambienteIdx, itemIdx, e.target.value)}
                    placeholder="Item do checklist"
                    className="h-9 flex-1 text-sm"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => removerItem(ambienteIdx, itemIdx)}
                    aria-label="Remover item"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                size="sm"
                variant="ghost"
                className="gap-1 text-xs"
                onClick={() => adicionarItem(ambienteIdx)}
              >
                <Plus className="h-3 w-3" /> Adicionar item
              </Button>
            </CardContent>
          </Card>
        ))}

        <Button variant="outline" className="w-full gap-2" onClick={adicionarAmbiente}>
          <Plus className="h-4 w-4" /> Adicionar ambiente
        </Button>

        <Textarea
          placeholder="Cole uma lista de itens (um por linha) para adicionar rápido ao primeiro ambiente"
          rows={3}
          className="text-sm"
          onBlur={(e) => {
            const linhas = e.target.value
              .split('\n')
              .map((l) => l.replace(/^[-•*]\s*/, '').trim())
              .filter(Boolean)
            if (linhas.length === 0) return
            setEstrutura((atual) => {
              const copia = atual.map((b) => ({ ...b, itens: [...b.itens] }))
              if (copia.length === 0) copia.push({ ambiente: '', itens: [] })
              copia[0].itens = [...copia[0].itens.filter(Boolean), ...linhas]
              return copia
            })
            e.target.value = ''
            toast.success(`${linhas.length} itens adicionados`)
          }}
        />
        <p className="text-[11px] text-muted-foreground">
          Cole e clique fora do campo: cada linha vira um item do primeiro ambiente.
        </p>
      </main>
    </div>
  )
}
