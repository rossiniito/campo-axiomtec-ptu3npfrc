/* Financeiro: margem por obra.

   A pergunta que o Bling não responde: "esta obra deu lucro?"
   Receita aprovada − equipamentos − despesas = margem.

   Honestidade de propósito: obra sem orçamento aprovado aparece como
   "sem receita", não como prejuízo. Chamar de prejuízo o que é dado
   faltando faria o Rossini tomar decisão errada. */
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ChevronLeft, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { type MargemObra, brl, carregarMargem } from '@/services/financeiro'

type Props = { onVoltar: () => void; onDespesas: () => void }

export default function Financeiro({ onVoltar, onDespesas }: Props) {
  const [linhas, setLinhas] = useState<MargemObra[]>([])
  const [totais, setTotais] = useState({ receita: 0, custo: 0, margem: 0, pendente: 0 })
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    carregarMargem()
      .then((r) => {
        setLinhas(r.linhas)
        setTotais(r.totais)
      })
      .catch(() => toast.error('Não foi possível calcular a margem'))
      .finally(() => setCarregando(false))
  }, [])

  const margemPct =
    totais.receita > 0 ? Math.round((totais.margem / totais.receita) * 1000) / 10 : 0

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-10 border-b bg-background px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onVoltar} aria-label="Voltar">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              AxiomTec · Financeiro
            </p>
            <h1 className="text-lg font-semibold">Margem por obra</h1>
          </div>
          <Button size="sm" variant="outline" className="gap-1" onClick={onDespesas}>
            <Wallet className="h-4 w-4" /> Despesas
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-3 px-4 py-4">
        <Card>
          <CardContent className="space-y-1 p-4">
            <p className="text-xs text-muted-foreground">Margem acumulada</p>
            <p className="text-3xl font-semibold">{brl(totais.margem)}</p>
            <p className="text-xs text-muted-foreground">
              {brl(totais.receita)} de receita aprovada − {brl(totais.custo)} de custo
              {totais.receita > 0 ? ` · ${margemPct}% de margem` : ''}
            </p>
            {totais.pendente > 0 && (
              <p className="pt-1 text-[11px] text-amber-700">
                {brl(totais.pendente)} em despesas aguardando aprovação — ainda fora da conta
              </p>
            )}
          </CardContent>
        </Card>

        {carregando && (
          <p className="py-8 text-center text-sm text-muted-foreground">Calculando…</p>
        )}

        {!carregando && linhas.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              Sem dado para calcular ainda. A margem aparece quando a obra tem orçamento aprovado,
              equipamento com valor de compra ou despesa lançada.
            </CardContent>
          </Card>
        )}

        {linhas.map((l) => (
          <Card key={l.obraId}>
            <CardContent className="space-y-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{l.obra}</p>
                  {l.cliente && (
                    <p className="truncate text-xs text-muted-foreground">{l.cliente}</p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  {l.temReceita ? (
                    <>
                      <p
                        className={`flex items-center gap-1 font-semibold ${
                          l.margem >= 0 ? 'text-emerald-700' : 'text-destructive'
                        }`}
                      >
                        {l.margem >= 0 ? (
                          <TrendingUp className="h-4 w-4" />
                        ) : (
                          <TrendingDown className="h-4 w-4" />
                        )}
                        {brl(l.margem)}
                      </p>
                      <Badge variant="outline" className="mt-1 text-[10px]">
                        {l.margemPct}%
                      </Badge>
                    </>
                  ) : (
                    <Badge variant="secondary" className="text-[10px]">
                      sem receita aprovada
                    </Badge>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1 border-t pt-2 text-center">
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground">Receita</p>
                  <p className="text-xs font-medium">{brl(l.receita)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground">Equipamento</p>
                  <p className="text-xs font-medium">{brl(l.equipamentos)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground">Despesa campo</p>
                  <p className="text-xs font-medium">{brl(l.despesas)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        <p className="px-1 pt-2 text-[11px] leading-relaxed text-muted-foreground">
          Como a conta é feita: orçamento aprovado da obra − equipamentos com valor de compra −
          despesas aprovadas e reembolsadas. Despesa pendente ou recusada não entra. Mão de obra
          própria ainda não está no cálculo — quando você quiser, entra como custo fixo rateado.
        </p>
      </main>
    </div>
  )
}
