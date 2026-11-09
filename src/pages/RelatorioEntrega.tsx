import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ChevronLeft, Download, FileText, Loader2, Send } from 'lucide-react'
import { toast } from 'sonner'
import Assinatura from '@/components/Assinatura'
import { type Ambiente, type Item, type Obra, lerCache } from '@/lib/offline'
import { baixarPDF, gerarRelatorioPDF } from '@/lib/relatorio'
import { salvarRelatorio, urlAssinatura, type Relatorio } from '@/services/relatorios'
import { listarRelatorios, marcarEnviado } from '@/services/relatorios'

type Props = {
  obra: Obra
  /** Quando vem de uma OS, o relatório cobre só os itens dela. */
  ordemServico?: string
  numeroOS?: string
  onVoltar: () => void
}

export default function RelatorioEntrega({ obra, ordemServico, numeroOS, onVoltar }: Props) {
  const [ambientes, setAmbientes] = useState<Ambiente[]>([])
  const [itens, setItens] = useState<Item[]>([])
  const [assinaturaCliente, setAssinaturaCliente] = useState<string | null>(null)
  const [assinaturaTecnico, setAssinaturaTecnico] = useState<string | null>(null)
  const [nomeResponsavel, setNomeResponsavel] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [gerando, setGerando] = useState(false)
  const [incluirFotos, setIncluirFotos] = useState(true)
  const [historico, setHistorico] = useState<Relatorio[]>([])

  useEffect(() => {
    const cache = lerCache()
    // se veio de uma OS, só os itens dela entram no relatório
    const meusItens = ordemServico
      ? cache.itens.filter((i) => i.ordem_servico === ordemServico)
      : cache.itens.filter((i) => i.obra === obra.id)
    const idsAmb = new Set(meusItens.map((i) => i.ambiente))
    setItens(meusItens)
    setAmbientes(cache.ambientes.filter((a) => idsAmb.has(a.id)))
    listarRelatorios(obra.id)
      .then(setHistorico)
      .catch(() => undefined)
  }, [obra.id, ordemServico])

  const total = itens.length
  const concluidos = itens.filter((i) => i.concluido).length
  const pendentes = total - concluidos

  async function gerar() {
    if (!assinaturaCliente) {
      toast.error('Falta a assinatura do cliente', {
        description: 'O aceite é o que dá validade ao relatório.',
      })
      return
    }

    setGerando(true)
    try {
      const dados = incluirFotos ? itens : itens.map((i) => ({ ...i, foto: [] as string[] }))
      const { blob, nome } = await gerarRelatorioPDF({
        obra,
        ambientes,
        itens: dados as Item[],
        assinaturas: {
          cliente: assinaturaCliente,
          tecnico: assinaturaTecnico,
          nomeResponsavel,
          observacoes,
          dataAssinatura: new Date().toISOString(),
        },
      })
      baixarPDF(blob, nome)

      const salvo = await salvarRelatorio({
        obra,
        ordemServico,
        ambientes,
        itens,
        assinaturaCliente,
        assinaturaTecnico,
        nomeResponsavel,
        observacoes,
      })
      setHistorico((atual) => [salvo, ...atual])
      toast.success('Relatório gerado', { description: 'O PDF foi baixado no seu aparelho.' })
    } catch (e) {
      toast.error('Não foi possível gerar o PDF', { description: String(e) })
    }
    setGerando(false)
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-10 border-b bg-background px-4 py-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onVoltar} aria-label="Voltar">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold">
              {numeroOS ? `Relatório ${numeroOS}` : 'Relatório de entrega'}
            </h1>
            <p className="truncate text-xs text-muted-foreground">{obra.nome}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-5 px-4 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">
            {concluidos} de {total} concluídos
          </Badge>
          {pendentes > 0 && <Badge variant="outline">{pendentes} pendentes no relatório</Badge>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="responsavel">Nome de quem recebeu no local</Label>
          <Input
            id="responsavel"
            value={nomeResponsavel}
            onChange={(e) => setNomeResponsavel(e.target.value)}
            placeholder="Ex.: Marina"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="obs">Considerações para o cliente (opcional)</Label>
          <Textarea
            id="obs"
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Ex.: a caixa central do home theater será instalada após o retoque de pintura no teto."
            rows={3}
          />
        </div>

        <label className="flex items-start gap-2 text-sm leading-snug">
          <input
            type="checkbox"
            checked={incluirFotos}
            onChange={(e) => setIncluirFotos(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-primary"
          />
          Incluir registro fotográfico no PDF
        </label>

        <Assinatura rotulo="Assinatura do cliente" onChange={setAssinaturaCliente} altura={150} />
        <Assinatura rotulo="Assinatura do técnico" onChange={setAssinaturaTecnico} altura={130} />

        <Button className="w-full gap-2" onClick={gerar} disabled={gerando}>
          {gerando ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Gerar PDF e registrar aceite
        </Button>

        {historico.length > 0 && (
          <section className="space-y-2 pt-2">
            <h2 className="text-sm font-semibold">Relatórios já emitidos nesta obra</h2>
            <ul className="space-y-2">
              {historico.map((rel) => {
                const data = rel.assinado_em || rel.created
                return (
                  <li key={rel.id} className="rounded-lg border bg-card p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="flex items-center gap-1 text-sm font-medium">
                          <FileText className="h-3.5 w-3.5" />
                          {data
                            ? new Date(data).toLocaleString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : 'Sem data'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {rel.itens_concluidos ?? '—'} de {rel.total_itens ?? '—'} itens
                          {rel.nome_responsavel ? ` · recebido por ${rel.nome_responsavel}` : ''}
                        </p>
                        {rel.enviado_em && (
                          <Badge variant="outline" className="mt-1 text-[10px]">
                            enviado ao cliente
                          </Badge>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          disabled
                          title="Reemissão volta na próxima etapa"
                        >
                          PDF
                        </Button>
                        {!rel.enviado_em && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            onClick={async () => {
                              await marcarEnviado(rel.id)
                              setHistorico(await listarRelatorios(obra.id))
                              toast.success('Marcado como enviado')
                            }}
                          >
                            <Send className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        )}
      </main>
    </div>
  )
}
