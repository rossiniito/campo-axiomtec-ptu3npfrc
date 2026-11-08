import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChevronRight, WifiOff, RefreshCw, Download } from 'lucide-react'
import { toast } from 'sonner'
import ChecklistObra from './ChecklistObra'
import { type Cache, type Obra, baixarTudo, lerCache, lerFila, sincronizar } from '@/lib/offline'

const ROTULO_STATUS: Record<string, string> = {
  aguardando: 'Aguardando',
  executando: 'Executando',
  finalizado: 'Finalizado',
}

const CACHE_VAZIO: Cache = { obras: [], ambientes: [], itens: [], atualizadoEm: null }

export default function Index() {
  const [cache, setCache] = useState<Cache>(CACHE_VAZIO)
  const [obraSelecionada, setObraSelecionada] = useState<Obra | null>(null)
  const [online, setOnline] = useState(navigator.onLine)
  const [carregando, setCarregando] = useState(true)
  const [offlineNaPrimeiraCarga, setOfflineNaPrimeiraCarga] = useState(false)
  const [pendentes, setPendentes] = useState(0)

  useEffect(() => {
    const local = lerCache()
    if (local.obras.length > 0) setCache(local)
    setPendentes(lerFila().length)

    // Ao abrir com sinal, primeiro esvazia a fila e só depois baixa,
    // senão os dados do servidor sobrescrevem a alteração feita offline.
    async function carregar() {
      try {
        if (navigator.onLine) await sincronizar()
        const dados = await baixarTudo()
        setCache(dados)
        setPendentes(lerFila().length)
      } catch {
        if (local.obras.length === 0) setOfflineNaPrimeiraCarga(true)
      } finally {
        setCarregando(false)
      }
    }
    carregar()

    const aoVoltarSinal = async () => {
      setOnline(true)
      try {
        await sincronizar()
        const dados = await baixarTudo()
        setCache(dados)
        setPendentes(lerFila().length)
      } catch {
        /* segue com o cache */
      }
    }
    const aoPerderSinal = () => setOnline(false)

    window.addEventListener('online', aoVoltarSinal)
    window.addEventListener('offline', aoPerderSinal)
    return () => {
      window.removeEventListener('online', aoVoltarSinal)
      window.removeEventListener('offline', aoPerderSinal)
    }
  }, [])

  async function prepararOffline() {
    try {
      const dados = await baixarTudo()
      setCache(dados)
      toast.success('Obras baixadas neste aparelho', {
        description: 'Você pode fechar o app: o checklist abre sem internet.',
      })
    } catch {
      toast.error('Sem conexão para baixar agora')
    }
  }

  async function enviarPendentes() {
    try {
      const r = await sincronizar()
      const dados = await baixarTudo()
      setCache(dados)
      setPendentes(r.restantes)
      toast.success(r.enviados > 0 ? `${r.enviados} enviada(s)` : 'Nada a enviar')
    } catch {
      toast.error('Sem conexão')
    }
  }

  if (obraSelecionada) {
    return <ChecklistObra obra={obraSelecionada} onVoltar={() => setObraSelecionada(null)} />
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-4 py-5">
        <div className="mx-auto max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            AxiomTec · Campo
          </p>
          <h1 className="mt-1 text-2xl font-semibold">Minhas obras</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {online ? (
              <Badge variant="secondary">Online</Badge>
            ) : (
              <Badge variant="destructive" className="gap-1">
                <WifiOff className="h-3 w-3" /> Offline
              </Badge>
            )}
            {pendentes > 0 && <Badge variant="outline">{pendentes} pendentes de envio</Badge>}
            {cache.atualizadoEm && (
              <span className="text-xs text-muted-foreground">
                Atualizado em{' '}
                {new Date(cache.atualizadoEm).toLocaleString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-3 px-4 py-4">
        {carregando && cache.obras.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">Carregando obras…</p>
        )}

        {offlineNaPrimeiraCarga && (
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="text-base">Primeira carga sem internet</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                Abra o app uma vez com sinal para baixar as obras neste aparelho. Depois disso ele
                funciona no subsolo.
              </p>
              <Button size="sm" onClick={() => window.location.reload()}>
                Tentar novamente
              </Button>
            </CardContent>
          </Card>
        )}

        {cache.obras.map((obra) => {
          const doObra = cache.itens.filter((i) => i.obra === obra.id)
          const prontos = doObra.filter((i) => i.concluido).length
          const percentual = doObra.length > 0 ? Math.round((prontos / doObra.length) * 100) : 0

          return (
            <button
              key={obra.id}
              onClick={() => setObraSelecionada(obra)}
              className="w-full rounded-xl border bg-card p-4 text-left transition-colors hover:bg-accent/50"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{obra.nome}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {obra.arquiteta ? `Arq. ${obra.arquiteta}` : obra.endereco}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
              </div>
              <div className="mt-3 flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${percentual}%` }}
                  />
                </div>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {prontos}/{doObra.length}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {ROTULO_STATUS[obra.status ?? ''] ?? obra.status}
                </Badge>
              </div>
            </button>
          )
        })}

        {pendentes > 0 && (
          <Button className="w-full gap-2" onClick={enviarPendentes}>
            <RefreshCw className="h-4 w-4" />
            Enviar {pendentes} alteração(ões) pendente(s)
          </Button>
        )}

        {!carregando && cache.obras.length > 0 && (
          <Button variant="outline" className="w-full gap-2" onClick={prepararOffline}>
            <Download className="h-4 w-4" />
            Baixar obras para uso offline
          </Button>
        )}
      </main>

      <footer className="mx-auto max-w-2xl px-4 pb-8">
        <p className="flex items-center justify-center gap-1 text-center text-xs text-muted-foreground">
          <RefreshCw className="h-3 w-3" />
          Protótipo local-first · alterações sem sinal ficam no aparelho e sobem sozinhas
        </p>
      </footer>
    </div>
  )
}
