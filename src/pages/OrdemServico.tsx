import { useEffect, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  ChevronLeft,
  Clock,
  Download,
  FileText,
  Link2,
  Loader2,
  LogIn,
  LogOut,
  Plus,
  RefreshCw,
  Sparkles,
  WifiOff,
} from 'lucide-react'
import { toast } from 'sonner'
import RelatorioEntrega from './RelatorioEntrega'
import AdicionarTarefa from '@/components/AdicionarTarefa'
import {
  type Ordem,
  ROTULO_STATUS,
  registrarCheckin,
  registrarCheckout,
  atualizarOrdem,
} from '@/services/ordens'
import { type Modelo, aplicarModeloNaOS, listarModelos, totalDeItens } from '@/services/modelos'
import {
  type Ambiente,
  type Item,
  baixarTudo,
  comAlteracoesLocais,
  criarTarefaAvulsa,
  enfileirar,
  itensAvulsosLocais,
  lerCache,
  lerFila,
  sincronizar,
} from '@/lib/offline'
import { eSessaoExpirada, useAuth } from '@/lib/auth'

type Props = {
  ordem: Ordem
  onVoltar: () => void
  onAtualizada: (o: Ordem) => void
}

const NOME_TECNICO_KEY = 'campo:tecnico'

export default function OrdemServico({ ordem, onVoltar, onAtualizada }: Props) {
  const [itens, setItens] = useState<Item[]>([])
  const [ambientes, setAmbientes] = useState<Ambiente[]>([])
  const [online, setOnline] = useState(navigator.onLine)
  const [pendentes, setPendentes] = useState(0)
  const [mostrarRelatorio, setMostrarRelatorio] = useState(false)
  const [tecnico, setTecnico] = useState(ordem.tecnico ?? '')
  const [pendencia, setPendencia] = useState(ordem.pendencia_cliente ?? '')
  const [salvando, setSalvando] = useState(false)
  const [modelos, setModelos] = useState<Modelo[]>([])
  const [aplicando, setAplicando] = useState<string | null>(null)
  const { usuario } = useAuth()

  function carregar() {
    const cache = comAlteracoesLocais(lerCache())
    // tarefas avulsas criadas offline ainda não têm registro no servidor:
    // entram na lista como itens temporários (id "local:...") até sincronizar
    const avulsasPendentes = itensAvulsosLocais(ordem.obra).filter(
      (t) => t.ordem_servico === ordem.id,
    )
    const daOrdem = [
      ...cache.itens.filter((i) => i.ordem_servico === ordem.id),
      ...avulsasPendentes,
    ]
    setItens(daOrdem)
    const idsAmb = new Set(daOrdem.map((i) => i.ambiente))
    setAmbientes(cache.ambientes.filter((a) => idsAmb.has(a.id)))
    setPendentes(lerFila().length + avulsasPendentes.length)
  }

  useEffect(() => {
    const salvo = localStorage.getItem(NOME_TECNICO_KEY)
    if (salvo && !ordem.tecnico) setTecnico(salvo)
    carregar()

    const aoMudar = async () => {
      const on = navigator.onLine
      setOnline(on)
      if (on) {
        try {
          await sincronizar()
          await baixarTudo()
          carregar()
        } catch {
          /* segue offline */
        }
      }
    }
    window.addEventListener('online', aoMudar)
    window.addEventListener('offline', () => setOnline(false))
    return () => {
      window.removeEventListener('online', aoMudar)
      window.removeEventListener('offline', () => setOnline(false))
    }
  }, [ordem.id])

  // busca os modelos só quando a OS está vazia (o técnico vai precisar escolher)
  useEffect(() => {
    if (itens.length > 0) return
    listarModelos()
      .then(setModelos)
      .catch(() => undefined)
  }, [itens.length])

  const total = itens.length
  const prontos = itens.filter((i) => i.concluido).length
  const percentual = total > 0 ? Math.round((prontos / total) * 100) : 0

  function alternar(item: Item, novo: boolean) {
    setItens((atual) => atual.map((i) => (i.id === item.id ? { ...i, concluido: novo } : i)))
    enfileirar({ itemId: item.id, concluido: novo, observacao: item.observacao ?? '' })
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

  async function checkin() {
    if (!tecnico.trim()) {
      toast.error('Diga quem está executando', { description: 'O nome fica gravado na OS.' })
      return
    }
    localStorage.setItem(NOME_TECNICO_KEY, tecnico.trim())
    try {
      setSalvando(true)
      await sincronizar()
      const atualizada = await registrarCheckin(ordem.id, tecnico.trim())
      onAtualizada(atualizada)
      toast.success('Entrada registrada')
    } catch {
      toast.error('Sem conexão para registrar a entrada', {
        description: 'O checklist continua funcionando; a hora entra quando voltar o sinal.',
      })
    }
    setSalvando(false)
  }

  async function checkout() {
    try {
      setSalvando(true)
      await sincronizar()
      await atualizarOrdem(ordem.id, { pendencia_cliente: pendencia, tecnico: tecnico })
      const atualizada = await registrarCheckout(ordem.id)
      onAtualizada(atualizada)
      toast.success('Saída registrada')
    } catch {
      toast.error('Sem conexão para registrar a saída')
    }
    setSalvando(false)
  }

  async function sincronizarAgora() {
    try {
      const r = await sincronizar()
      await baixarTudo()
      carregar()
      toast.success(r.enviados > 0 ? `${r.enviados} enviada(s)` : 'Tudo sincronizado')
    } catch {
      toast.error('Sem conexão')
    }
  }

  /** Cria a tarefa avulsa na seção desta OS; offline, fica no aparelho e sobe depois. */
  async function adicionarTarefa(ambiente: Ambiente, nome: string) {
    const nomeLimpo = nome.trim()
    if (!nomeLimpo) return
    const r = await criarTarefaAvulsa({
      obra: ordem.obra,
      ambiente: ambiente.id,
      ordemServico: ordem.id,
      nome: nomeLimpo,
      criadoPor: usuario?.id ?? '',
      online,
    })
    carregar()
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

  async function aplicarModelo(modelo: Modelo) {
    setAplicando(modelo.id)
    try {
      const r = await aplicarModeloNaOS(ordem.id, modelo.id)
      await baixarTudo()
      carregar()
      onAtualizada({ ...ordem, modelo: modelo.id })

      if (r.clickup === 'criado') {
        toast.success('Modelo aplicado e checklist criado no ClickUp', {
          description: `${r.ambientes} ambientes · ${r.itens} itens`,
        })
      } else if (r.clickup === 'sem_token') {
        toast.warning('Checklist criado no app', {
          description: 'No ClickUp não foi criado: falta configurar o token.',
        })
      } else if (r.clickup === 'sem_tarefa_vinculada') {
        toast.success('Modelo aplicado', {
          description:
            'Esta OS não está ligada a uma tarefa do ClickUp, então o checklist ficou só aqui.',
        })
      } else if (r.clickup === 'parcial') {
        toast.warning('Aplicado com falhas no ClickUp', {
          description: r.avisos.join(' · '),
        })
      } else {
        toast.success(`${r.itens} itens criados`)
      }
    } catch (e) {
      toast.error('Não foi possível aplicar o modelo', { description: String(e) })
    }
    setAplicando(null)
  }

  if (mostrarRelatorio) {
    const obraExpandida = ordem.expand?.obra
    return (
      <RelatorioEntrega
        obra={
          {
            id: obraExpandida?.id ?? ordem.obra,
            nome: obraExpandida?.nome ?? ordem.descricao ?? 'Obra',
            cliente: obraExpandida?.cliente,
            endereco: obraExpandida?.endereco,
          } as never
        }
        ordemServico={ordem.id}
        numeroOS={ordem.numero}
        onVoltar={() => {
          setMostrarRelatorio(false)
          carregar()
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
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {ordem.numero}
            </p>
            <h1 className="truncate text-lg font-semibold">
              {ordem.expand?.obra?.nome ?? ordem.descricao}
            </h1>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={() => setMostrarRelatorio(true)}
            disabled={total === 0}
          >
            <FileText className="h-3.5 w-3.5" />
            Relatório
          </Button>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${percentual}%` }} />
          </div>
          <span className="text-sm font-medium tabular-nums">
            {prontos}/{total}
          </span>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{ROTULO_STATUS[ordem.status ?? 'aberta']}</Badge>
          {online ? (
            <Badge variant="outline">Online</Badge>
          ) : (
            <Badge variant="destructive" className="gap-1">
              <WifiOff className="h-3 w-3" /> Offline
            </Badge>
          )}
          {pendentes > 0 && (
            <Badge variant="outline">
              {pendentes} {pendentes === 1 ? 'pendente' : 'pendentes'}
            </Badge>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto h-7 gap-1 text-xs"
            onClick={sincronizarAgora}
          >
            <RefreshCw className="h-3 w-3" /> Sincronizar
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 py-4">
        {total === 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4" /> Escolha o checklist desta OS
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">
                A tarefa no ClickUp veio sem checklist. Aplique um modelo e ele cria os itens aqui e
                o checklist na tarefa do ClickUp.
              </p>
              {modelos.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Nenhum modelo cadastrado ainda. Saia desta OS e toque na engrenagem da tela
                  inicial para montar o primeiro.
                </p>
              )}
              {modelos.map((modelo) => (
                <Button
                  key={modelo.id}
                  variant="outline"
                  className="h-auto w-full justify-between gap-2 py-2"
                  onClick={() => aplicarModelo(modelo)}
                  disabled={aplicando !== null}
                >
                  <span className="min-w-0 text-left">
                    <span className="block truncate text-sm font-medium">{modelo.nome}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      {modelo.estrutura?.length ?? 0} ambientes ·{' '}
                      {totalDeItens(modelo.estrutura ?? [])} itens
                    </span>
                  </span>
                  {aplicando === modelo.id ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 shrink-0" />
                  )}
                </Button>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Registro do dia</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="tecnico" className="text-xs">
                Técnico
              </Label>
              <Input
                id="tecnico"
                value={tecnico}
                onChange={(e) => setTecnico(e.target.value)}
                placeholder="Seu nome"
                className="h-9"
              />
            </div>

            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              {ordem.checkin_em && (
                <span className="flex items-center gap-1">
                  <LogIn className="h-3 w-3" />
                  Entrada {new Date(ordem.checkin_em).toLocaleString('pt-BR')}
                </span>
              )}
              {ordem.checkout_em && (
                <span className="flex items-center gap-1">
                  <LogOut className="h-3 w-3" />
                  Saída {new Date(ordem.checkout_em).toLocaleString('pt-BR')}
                </span>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1 gap-1"
                onClick={checkin}
                disabled={salvando || Boolean(ordem.checkin_em)}
              >
                {salvando ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <LogIn className="h-3 w-3" />
                )}
                Registrar entrada
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 gap-1"
                onClick={checkout}
                disabled={salvando || !ordem.checkin_em || Boolean(ordem.checkout_em)}
              >
                <LogOut className="h-3 w-3" />
                Registrar saída
              </Button>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pendencia" className="text-xs">
                Alguma pendência por parte do cliente?
              </Label>
              <Textarea
                id="pendencia"
                value={pendencia}
                onChange={(e) => setPendencia(e.target.value)}
                onBlur={() =>
                  atualizarOrdem(ordem.id, { pendencia_cliente: pendencia }).catch(() => undefined)
                }
                placeholder="Ex.: aguardando liberação do quadro elétrico"
                rows={2}
                className="text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                Vai para o campo do ClickUp na sincronização noturna.
              </p>
            </div>

            {ordem.ultimo_erro_sync && (
              <p className="rounded-md bg-destructive/10 p-2 text-[11px] text-destructive">
                Última sincronização falhou: {ordem.ultimo_erro_sync}
              </p>
            )}
            {ordem.sincronizada_em && (
              <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Clock className="h-3 w-3" />
                Enviado ao ClickUp em {new Date(ordem.sincronizada_em).toLocaleString('pt-BR')}
                {ordem.observacao_sync ? ` · ${ordem.observacao_sync}` : ''}
              </p>
            )}
            {ordem.clickup_task_url && (
              <a
                href={ordem.clickup_task_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-[11px] text-primary underline"
              >
                <Link2 className="h-3 w-3" /> Abrir a tarefa no ClickUp
              </a>
            )}
          </CardContent>
        </Card>

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
                    className={`rounded-lg border p-3 ${
                      item.concluido ? 'bg-muted/50' : 'bg-card'
                    }`}
                  >
                    <label className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={item.concluido}
                        onChange={(e) => alternar(item, e.target.checked)}
                        className="mt-0.5 h-5 w-5 accent-primary"
                      />
                      <span
                        className={`flex-1 text-sm leading-snug ${
                          item.concluido ? 'text-muted-foreground line-through' : ''
                        }`}
                      >
                        {item.nome}
                      </span>
                    </label>
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
              <AdicionarTarefa
                onSalvar={(nome) => {
                  void adicionarTarefa(ambiente, nome)
                }}
                onCancelar={() => undefined}
              />
            </section>
          )
        })}

        {total > 0 && (
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => setMostrarRelatorio(true)}
          >
            <Download className="h-4 w-4" />
            Fechar o dia e gerar o relatório
          </Button>
        )}
      </main>
    </div>
  )
}
