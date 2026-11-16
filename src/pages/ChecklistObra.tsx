import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import {
  ChevronLeft,
  Camera,
  WifiOff,
  RefreshCw,
  Check,
  FileText,
  Plus,
  Trash2,
} from 'lucide-react'
import { garantirTokenArquivo } from '@/lib/files'
import { eSessaoExpirada, useAuth } from '@/lib/auth'
import { toast } from 'sonner'
import RelatorioEntrega from './RelatorioEntrega'
import AdicionarTarefa from '@/components/AdicionarTarefa'
import {
  type Ambiente,
  type Item,
  type Obra,
  apagarFoto,
  comAlteracoesLocais,
  criarTarefaAvulsa,
  enfileirar,
  enviarFoto,
  itensAvulsosLocais,
  lerCache,
  lerFila,
  sincronizar,
  urlsFotos,
  baixarTudo,
} from '@/lib/offline'

type Props = {
  obra: Obra
  onVoltar: () => void
}

export default function ChecklistObra({ obra, onVoltar }: Props) {
  const [ambientes, setAmbientes] = useState<Ambiente[]>([])
  const [itens, setItens] = useState<Item[]>([])
  const [online, setOnline] = useState(navigator.onLine)
  const [pendentes, setPendentes] = useState(0)
  const [sincronizando, setSincronizando] = useState(false)
  const [mostrarRelatorio, setMostrarRelatorio] = useState(false)
  // muda quando o token de arquivo chega: as fotos protegidas recarregam
  const [tokenArquivo, setTokenArquivo] = useState(0)
  const { usuario } = useAuth()

  function carregarDoCache() {
    // comAlteracoesLocais reaplica a fila: sem isso, recarregar a página
    // offline mostraria o dado antigo e a marcação sumiria da tela.
    const cache = comAlteracoesLocais(lerCache())
    setAmbientes(cache.ambientes.filter((a) => a.obra === obra.id))
    // tarefas avulsas criadas offline ainda não têm registro no servidor:
    // entram na lista como itens temporários (id "local:...") até sincronizar
    const avulsasPendentes = itensAvulsosLocais(obra.id)
    setItens([...cache.itens.filter((i) => i.obra === obra.id), ...avulsasPendentes])
    setPendentes(lerFila().length + avulsasPendentes.length)
    // foto é arquivo protegido: sem token a imagem não abre
    garantirTokenArquivo().then(() => setTokenArquivo((n) => n + 1))
  }

  useEffect(() => {
    carregarDoCache()

    const aoMudarConexao = async () => {
      const conectado = navigator.onLine
      setOnline(conectado)
      if (conectado) {
        setSincronizando(true)
        try {
          await sincronizar()
          await baixarTudo()
          carregarDoCache()
        } catch {
          /* segue offline */
        }
        setSincronizando(false)
      }
    }

    window.addEventListener('online', aoMudarConexao)
    window.addEventListener('offline', () => setOnline(false))
    return () => {
      window.removeEventListener('online', aoMudarConexao)
      window.removeEventListener('offline', () => setOnline(false))
    }
  }, [obra.id])

  function alternar(item: Item, novoValor: boolean) {
    setItens((atual) => atual.map((i) => (i.id === item.id ? { ...i, concluido: novoValor } : i)))
    enfileirar({ itemId: item.id, concluido: novoValor, observacao: item.observacao ?? '' })
    setPendentes(lerFila().length)

    if (online) {
      sincronizar()
        .then((r) => setPendentes(r.restantes))
        .catch(() => undefined)
    }
  }

  function salvarObservacao(item: Item, texto: string) {
    setItens((atual) => atual.map((i) => (i.id === item.id ? { ...i, observacao: texto } : i)))
    enfileirar({ itemId: item.id, concluido: item.concluido, observacao: texto })
    setPendentes(lerFila().length)
  }

  async function anexarFoto(item: Item, arquivo: File) {
    if (!online) {
      toast.error('Foto precisa de conexão', {
        description: 'O texto e o checklist funcionam offline; a foto só sobe com sinal.',
      })
      return
    }
    try {
      await enviarFoto(item.id, arquivo)
      await baixarTudo()
      carregarDoCache()
      toast.success('Foto anexada')
    } catch {
      toast.error('Não foi possível enviar a foto')
    }
  }

  async function removerFoto(item: Item, nome: string) {
    if (!online) {
      toast.error('Remover foto precisa de conexão')
      return
    }
    try {
      await apagarFoto(item.id, nome)
      await baixarTudo()
      carregarDoCache()
      toast.success('Foto removida')
    } catch {
      toast.error('Não foi possível remover')
    }
  }

  /** Cria a tarefa avulsa na seção; offline, fica no aparelho e sobe depois. */
  async function adicionarTarefa(ambiente: Ambiente, nome: string) {
    const nomeLimpo = nome.trim()
    if (!nomeLimpo) return
    const r = await criarTarefaAvulsa({
      obra: obra.id,
      ambiente: ambiente.id,
      nome: nomeLimpo,
      criadoPor: usuario?.id ?? '',
      online,
    })
    carregarDoCache()
    if (r.erro !== undefined) {
      if (eSessaoExpirada(r.erro)) return
    }
    if (r.noServidor) {
      toast.success('Tarefa adicionada')
    } else {
      toast.success('Tarefa adicionada', {
        description: online
          ? 'Sem permissão agora — ficou no aparelho e tenta subir ao sincronizar.'
          : 'Salva no aparelho; sobe para o servidor quando o sinal voltar.',
      })
    }
  }
  async function sincronizarAgora() {
    setSincronizando(true)
    try {
      const r = await sincronizar()
      await baixarTudo()
      carregarDoCache()
      toast.success(r.enviados > 0 ? `${r.enviados} enviada(s)` : 'Tudo sincronizado')
    } catch {
      toast.error('Sem conexão para sincronizar')
    }
    setSincronizando(false)
  }

  const total = itens.length
  const prontos = itens.filter((i) => i.concluido).length
  const percentual = total > 0 ? Math.round((prontos / total) * 100) : 0

  if (mostrarRelatorio) {
    return (
      <RelatorioEntrega
        obra={obra}
        onVoltar={() => {
          setMostrarRelatorio(false)
          carregarDoCache()
        }}
      />
    )
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-10 border-b bg-background px-4 py-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onVoltar} aria-label="Voltar">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold">{obra.nome}</h1>
            <p className="truncate text-xs text-muted-foreground">
              {obra.arquiteta ? `Arq. ${obra.arquiteta}` : obra.endereco}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={() => setMostrarRelatorio(true)}
          >
            <FileText className="h-3.5 w-3.5" />
            Relatório
          </Button>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <Progress value={percentual} className="h-2 flex-1" />
          <span className="text-sm font-medium tabular-nums">
            {prontos}/{total}
          </span>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          {online ? (
            <Badge variant="secondary" className="gap-1">
              <Check className="h-3 w-3" /> Online
            </Badge>
          ) : (
            <Badge variant="destructive" className="gap-1">
              <WifiOff className="h-3 w-3" /> Offline — salvando no aparelho
            </Badge>
          )}
          {pendentes > 0 && (
            <Badge variant="outline" className="gap-1">
              {pendentes} {pendentes === 1 ? 'alteração pendente' : 'alterações pendentes'}
            </Badge>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto h-7 gap-1 text-xs"
            onClick={sincronizarAgora}
            disabled={sincronizando}
          >
            <RefreshCw className={`h-3 w-3 ${sincronizando ? 'animate-spin' : ''}`} />
            Sincronizar
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 px-4 py-4">
        {ambientes.map((ambiente) => {
          const doAmbiente = itens
            .filter((i) => i.ambiente === ambiente.id)
            .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
          const feitos = doAmbiente.filter((i) => i.concluido).length

          return (
            <section key={ambiente.id}>
              <div className="mb-2 flex items-baseline justify-between">
                <h2 className="text-base font-semibold">{ambiente.nome}</h2>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {feitos} de {doAmbiente.length}
                </span>
              </div>

              <ul className="space-y-2">
                {doAmbiente.map((item) => {
                  // tokenArquivo força recalcular as URLs quando o token chega
                  const fotos = tokenArquivo >= 0 ? urlsFotos(item) : []
                  return (
                    <li
                      key={item.id}
                      className={`rounded-lg border p-3 transition-colors ${
                        item.concluido ? 'bg-muted/50' : 'bg-card'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id={item.id}
                          checked={item.concluido}
                          onCheckedChange={(valor) => alternar(item, valor === true)}
                          className="mt-0.5 h-5 w-5"
                        />
                        <label
                          htmlFor={item.id}
                          className={`flex-1 text-sm leading-snug ${
                            item.concluido ? 'text-muted-foreground line-through' : ''
                          }`}
                        >
                          {item.nome}
                        </label>

                        <label className="cursor-pointer text-muted-foreground hover:text-foreground">
                          <Camera className="h-4 w-4" />
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            multiple
                            className="hidden"
                            onChange={(e) => {
                              const arquivos = Array.from(e.target.files ?? [])
                              arquivos.forEach((arquivo) => anexarFoto(item, arquivo))
                              e.target.value = ''
                            }}
                          />
                        </label>
                      </div>

                      {fotos.length > 0 && (
                        <ul className="mt-2 flex flex-wrap gap-2">
                          {fotos.map((f) => (
                            <li key={f.nome} className="group relative">
                              <a href={f.original} target="_blank" rel="noreferrer">
                                <img
                                  src={f.miniatura}
                                  alt={`Foto de ${item.nome}`}
                                  className="h-20 w-20 rounded object-cover"
                                />
                              </a>
                              <button
                                type="button"
                                aria-label="Remover foto"
                                onClick={() => removerFoto(item, f.nome)}
                                className="absolute right-0.5 top-0.5 rounded bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}

                      <Textarea
                        defaultValue={item.observacao ?? ''}
                        placeholder="Observação (opcional)"
                        rows={1}
                        className="mt-2 min-h-0 resize-none border-0 bg-transparent px-0 text-xs shadow-none focus-visible:ring-0"
                        onBlur={(e) => salvarObservacao(item, e.target.value)}
                      />
                    </li>
                  )
                })}
              </ul>

              <AdicionarTarefa
                onSalvar={(nome) => {
                  void adicionarTarefa(ambiente, nome)
                }}
                onCancelar={() => undefined}
              />
            </section>
          )
        })}
      </main>
    </div>
  )
}

/** Campo inline para digitar o nome da tarefa nova e salvá-la na seção. */
function FormTarefaAvulsa({
  onSalvar,
  onCancelar,
}: {
  onSalvar: (nome: string) => void
  onCancelar: () => void
}) {
  const [nome, setNome] = useState('')

  function salvar() {
    if (nome.trim()) onSalvar(nome)
  }

  return (
    <div className="mt-2 rounded-lg border bg-card p-3">
      <Input
        autoFocus
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        placeholder="Nome da tarefa (ex.: Trocar lâmpada do nicho)"
        aria-label="Nome da tarefa"
        className="text-sm"
        onKeyDown={(e) => {
          if (e.key === 'Enter') salvar()
          if (e.key === 'Escape') onCancelar()
        }}
      />
      <div className="mt-2 flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancelar}>
          Cancelar
        </Button>
        <Button size="sm" onClick={salvar} disabled={!nome.trim()}>
          Salvar tarefa
        </Button>
      </div>
    </div>
  )
}
