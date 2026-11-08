import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { ChevronLeft, Camera, ImageIcon, WifiOff, RefreshCw, Check, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  type Ambiente,
  type Item,
  type Obra,
  apagarFoto,
  comAlteracoesLocais,
  enfileirar,
  enviarFoto,
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

  function carregarDoCache() {
    // comAlteracoesLocais reaplica a fila: sem isso, recarregar a página
    // offline mostraria o dado antigo e a marcação sumiria da tela.
    const cache = comAlteracoesLocais(lerCache())
    setAmbientes(cache.ambientes.filter((a) => a.obra === obra.id))
    setItens(cache.itens.filter((i) => i.obra === obra.id))
    setPendentes(lerFila().length)
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

  async function anexarFotos(item: Item, arquivos: File[]) {
    if (arquivos.length === 0) return
    if (!online) {
      toast.error(arquivos.length > 1 ? 'Fotos precisam de conexão' : 'Foto precisa de conexão', {
        description: 'O texto e o checklist funcionam offline; a foto só sobe com sinal.',
      })
      return
    }
    let enviadas = 0
    for (const arquivo of arquivos) {
      try {
        await enviarFoto(item.id, arquivo)
        enviadas++
      } catch {
        toast.error('Não foi possível enviar uma das fotos', {
          description: arquivo.name,
        })
      }
    }
    if (enviadas === 0) return
    try {
      await baixarTudo()
      carregarDoCache()
    } catch {
      /* o envio já foi feito; a próxima sincronização atualiza a tela */
    }
    toast.success(enviadas === 1 ? 'Foto anexada' : `${enviadas} fotos anexadas`)
  }

  async function apagarFotoDoItem(item: Item, nomeArquivo: string) {
    if (!window.confirm('Apagar esta foto? Ela será removida do checklist.')) return
    if (!online) {
      toast.error('Apagar foto precisa de conexão', {
        description: 'A remoção só é feita com sinal, para não desaparecer só neste aparelho.',
      })
      return
    }
    try {
      await apagarFoto(item.id, nomeArquivo)
      await baixarTudo()
      carregarDoCache()
      toast.success('Foto apagada')
    } catch {
      toast.error('Não foi possível apagar a foto')
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
                {doAmbiente.map((item) => (
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

                      <div className="flex shrink-0 items-center gap-1.5">
                        {/* Tirar foto: capture="environment" abre a câmera direto no celular */}
                        <label
                          className="cursor-pointer text-muted-foreground hover:text-foreground"
                          title="Tirar foto"
                        >
                          <Camera className="h-4 w-4" />
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            aria-label="Tirar foto"
                            onChange={(e) => {
                              const arquivo = e.target.files?.[0]
                              if (arquivo) anexarFotos(item, [arquivo])
                              e.target.value = ''
                            }}
                          />
                        </label>
                        {/* Escolher da galeria: sem capture, o celular abre o seletor de fotos */}
                        <label
                          className="cursor-pointer text-muted-foreground hover:text-foreground"
                          title="Escolher da galeria"
                        >
                          <ImageIcon className="h-4 w-4" />
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            aria-label="Escolher da galeria"
                            onChange={(e) => {
                              const arquivos = Array.from(e.target.files ?? [])
                              anexarFotos(item, arquivos)
                              e.target.value = ''
                            }}
                          />
                        </label>
                      </div>
                    </div>

                    {urlsFotos(item).length > 0 && (
                      <ul className="mt-2 flex flex-wrap gap-2">
                        {urlsFotos(item).map((foto) => (
                          <li key={foto.nome} className="relative">
                            <a href={foto.original} target="_blank" rel="noreferrer">
                              <img
                                src={foto.miniatura}
                                alt={`Foto de ${item.nome}`}
                                className="h-20 w-20 rounded object-cover"
                              />
                            </a>
                            <button
                              type="button"
                              onClick={() => apagarFotoDoItem(item, foto.nome)}
                              className="absolute right-1 top-1 rounded-full bg-background/90 p-1 text-destructive shadow hover:bg-background"
                              aria-label="Apagar foto"
                              title="Apagar foto"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
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
                ))}
              </ul>
            </section>
          )
        })}
      </main>
    </div>
  )
}
