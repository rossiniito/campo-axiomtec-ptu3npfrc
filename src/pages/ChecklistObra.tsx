import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { ChevronLeft, Camera, WifiOff, RefreshCw, Check } from 'lucide-react'
import { toast } from 'sonner'
import {
  type Ambiente,
  type Item,
  type Obra,
  comAlteracoesLocais,
  enfileirar,
  enviarFoto,
  lerCache,
  lerFila,
  sincronizar,
  urlFoto,
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

                      <label className="cursor-pointer text-muted-foreground hover:text-foreground">
                        <Camera className="h-4 w-4" />
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          onChange={(e) => {
                            const arquivo = e.target.files?.[0]
                            if (arquivo) anexarFoto(item, arquivo)
                          }}
                        />
                      </label>
                    </div>

                    {urlFoto(item) && (
                      <img
                        src={urlFoto(item) as string}
                        alt={`Foto de ${item.nome}`}
                        className="mt-2 h-20 w-20 rounded object-cover"
                      />
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
