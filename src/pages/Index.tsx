import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChevronRight, CloudDownload, Loader2, RefreshCw, WifiOff } from 'lucide-react'
import { toast } from 'sonner'
import OrdemServico from './OrdemServico'
import { type Ordem, ROTULO_STATUS, listarOrdens, puxarDoClickUp } from '@/services/ordens'
import {
  type Ambiente,
  type Item,
  baixarTudo,
  comAlteracoesLocais,
  lerCache,
  lerFila,
  sincronizar,
} from '@/lib/offline'

export default function Index() {
  const [ordens, setOrdens] = useState<Ordem[]>([])
  const [itens, setItens] = useState<Item[]>([])
  const [ambientes, setAmbientes] = useState<Ambiente[]>([])
  const [ordemAberta, setOrdemAberta] = useState<Ordem | null>(null)
  const [online, setOnline] = useState(navigator.onLine)
  const [carregando, setCarregando] = useState(true)
  const [buscando, setBuscando] = useState(false)
  const [pendentes, setPendentes] = useState(0)
  const [atualizadoEm, setAtualizadoEm] = useState<string | null>(null)

  function lerLocal() {
    const cache = comAlteracoesLocais(lerCache())
    setItens(cache.itens)
    setAmbientes(cache.ambientes)
    setAtualizadoEm(cache.atualizadoEm)
    setPendentes(lerFila().length)
  }

  async function recarregar() {
    const cache = await baixarTudo()
    setItens(cache.itens)
    setAmbientes(cache.ambientes)
    setAtualizadoEm(cache.atualizadoEm)
    setPendentes(lerFila().length)
    setOrdens(await listarOrdens())
  }

  useEffect(() => {
    lerLocal()
    async function carregar() {
      try {
        if (navigator.onLine) await sincronizar()
        await recarregar()
      } catch {
        /* segue com o que está no aparelho */
      } finally {
        setCarregando(false)
      }
    }
    carregar()

    const aoVoltarSinal = async () => {
      setOnline(true)
      try {
        await sincronizar()
        await recarregar()
      } catch {
        /* ignora */
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

  async function buscarNoClickUp() {
    setBuscando(true)
    try {
      const r = await puxarDoClickUp()
      await recarregar()
      toast.success(
        r.os_criadas > 0 ? `${r.os_criadas} OS nova(s) do ClickUp` : 'Nenhuma OS nova',
        { description: `${r.ja_existiam} já estavam aqui.` },
      )
    } catch (e) {
      toast.error('Não foi possível buscar no ClickUp', { description: String(e) })
    }
    setBuscando(false)
  }

  async function enviarPendentes() {
    try {
      const r = await sincronizar()
      await recarregar()
      toast.success(r.enviados > 0 ? `${r.enviados} enviada(s)` : 'Nada a enviar')
    } catch {
      toast.error('Sem conexão')
    }
  }

  if (ordemAberta) {
    return (
      <OrdemServico
        ordem={ordemAberta}
        onVoltar={() => {
          setOrdemAberta(null)
          recarregar().catch(() => undefined)
        }}
        onAtualizada={(o) => {
          setOrdemAberta(o)
          setOrdens((atual) => atual.map((x) => (x.id === o.id ? { ...x, ...o } : x)))
        }}
      />
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-4 py-5">
        <div className="mx-auto max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            AxiomTec · Campo
          </p>
          <h1 className="mt-1 text-2xl font-semibold">Minhas ordens de serviço</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {online ? (
              <Badge variant="secondary">Online</Badge>
            ) : (
              <Badge variant="destructive" className="gap-1">
                <WifiOff className="h-3 w-3" /> Offline
              </Badge>
            )}
            {pendentes > 0 && <Badge variant="outline">{pendentes} pendentes de envio</Badge>}
            {atualizadoEm && (
              <span className="text-xs text-muted-foreground">
                Atualizado em{' '}
                {new Date(atualizadoEm).toLocaleString('pt-BR', {
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
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={buscarNoClickUp}
          disabled={buscando}
        >
          {buscando ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CloudDownload className="h-4 w-4" />
          )}
          Buscar ordens novas no ClickUp
        </Button>

        {carregando && ordens.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">Carregando ordens…</p>
        )}

        {!carregando && ordens.length === 0 && (
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="text-base">Nenhuma OS ainda</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Toque em “Buscar ordens novas no ClickUp” para trazer as tarefas da lista Instalação.
            </CardContent>
          </Card>
        )}

        {ordens.map((ordem) => {
          const daOrdem = itens.filter((i) => i.ordem_servico === ordem.id)
          const prontos = daOrdem.filter((i) => i.concluido).length
          const percentual = daOrdem.length > 0 ? Math.round((prontos / daOrdem.length) * 100) : 0
          const nome = ordem.expand?.obra?.nome ?? ordem.descricao ?? ''

          return (
            <button
              key={ordem.id}
              onClick={() => setOrdemAberta(ordem)}
              className="w-full rounded-xl border bg-card p-4 text-left transition-colors hover:bg-accent/50"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {ordem.numero}
                  </p>
                  <p className="truncate font-semibold">{nome}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {ordem.clickup_status || 'sem status no ClickUp'}
                    {ordem.checkin_em ? ' · entrada registrada' : ''}
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
                  {prontos}/{daOrdem.length}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {ROTULO_STATUS[ordem.status ?? 'aberta']}
                </Badge>
                {ordem.sincronizada_em && (
                  <Badge variant="outline" className="text-xs">
                    sincronizada
                  </Badge>
                )}
                {ordem.ultimo_erro_sync && (
                  <Badge variant="destructive" className="text-xs">
                    erro de sync
                  </Badge>
                )}
                {!ordem.checkin_em && (
                  <Badge variant="outline" className="text-xs">
                    sem entrada
                  </Badge>
                )}
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

        <p className="pt-2 text-center text-xs text-muted-foreground">
          {ambientes.length > 0
            ? `${ambientes.length} ambientes no aparelho · funciona sem sinal`
            : 'Abra uma vez com sinal para baixar as ordens neste aparelho'}
        </p>
      </main>
    </div>
  )
}
