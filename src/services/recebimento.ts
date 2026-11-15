/* Recebimento e caixa: sinal + parcelas fixas, e a conta a pagar.

   Padrão do Rossini (12/11/2026): sinal 40% + 2 parcelas de 30%,
   variável conforme negociação. Por isso o gerador aceita qualquer divisão.
*/
import pb from '@/lib/pocketbase/client'

export type Recebimento = {
  id: string
  obra: string
  orcamento?: string
  tipo?: 'sinal' | 'parcela'
  descricao?: string
  percentual?: number
  valor: number
  vencimento: string
  status?: 'a_receber' | 'recebido' | 'atrasado' | 'cancelado'
  recebido_em?: string
  valor_recebido?: number
  forma?: 'pix' | 'boleto' | 'transferencia' | 'cartao' | 'dinheiro' | 'cheque'
  observacoes?: string
  expand?: { obra?: { id: string; nome: string } }
}

export type Pagamento = {
  id: string
  descricao: string
  fornecedor?: string
  obra?: string
  valor: number
  vencimento: string
  status?: 'a_pagar' | 'pago' | 'atrasado' | 'cancelado'
  pago_em?: string
  valor_pago?: number
  categoria?: string
  observacoes?: string
  expand?: { fornecedor?: { id: string; nome: string }; obra?: { id: string; nome: string } }
}

export const ROTULO_FORMA: Record<string, string> = {
  pix: 'PIX',
  boleto: 'Boleto',
  transferencia: 'Transferência',
  cartao: 'Cartão',
  dinheiro: 'Dinheiro',
  cheque: 'Cheque',
}

/* ---------- geração do cronograma ---------- */

export type ParcelaGerada = {
  tipo: 'sinal' | 'parcela'
  descricao: string
  percentual: number
  valor: number
  vencimento: string
}

/** Padrão do Rossini: 40% de sinal + duas de 30%. */
export const PADRAO_RECEBIMENTO = [40, 30, 30]

/**
 * Monta o cronograma. Percentuais devem somar 100.
 * A primeira parcela é o sinal (vencimento na data informada); as demais,
 * de mês em mês a partir dela.
 */
export function gerarCronograma(
  valorTotal: number,
  percentuais: number[],
  dataSinal: string,
): ParcelaGerada[] {
  const soma = percentuais.reduce((s, p) => s + p, 0)
  if (Math.abs(soma - 100) > 0.01) {
    throw new Error(`Os percentuais devem somar 100 (somam ${soma})`)
  }
  const base = new Date(dataSinal)
  const saida: ParcelaGerada[] = []
  let acumulado = 0

  percentuais.forEach((pct, i) => {
    const d = new Date(base)
    d.setMonth(d.getMonth() + i)
    // arredonda para 2 casas; a última assume a diferença para fechar o total
    const valor =
      i === percentuais.length - 1
        ? Math.round((valorTotal - acumulado) * 100) / 100
        : Math.round(valorTotal * (pct / 100) * 100) / 100
    acumulado += valor

    saida.push({
      tipo: i === 0 ? 'sinal' : 'parcela',
      descricao:
        i === 0 ? `Sinal (${pct}%)` : `Parcela ${i} de ${percentuais.length - 1} (${pct}%)`,
      percentual: pct,
      valor,
      vencimento: d.toISOString(),
    })
  })
  return saida
}

export async function criarCronograma(
  obraId: string,
  orcamentoId: string | undefined,
  valorTotal: number,
  percentuais: number[],
  dataSinal: string,
): Promise<ParcelaGerada[]> {
  const parcelas = gerarCronograma(valorTotal, percentuais, dataSinal)
  for (const p of parcelas) {
    await pb.collection('recebimentos').create({
      obra: obraId,
      orcamento: orcamentoId,
      tipo: p.tipo,
      descricao: p.descricao,
      percentual: p.percentual,
      valor: p.valor,
      vencimento: p.vencimento,
      status: 'a_receber',
    })
  }
  return parcelas
}

/* ---------- leitura e baixa ---------- */

export async function listarRecebimentos(): Promise<Recebimento[]> {
  return (await pb.collection('recebimentos').getFullList({
    sort: 'vencimento',
    expand: 'obra',
  })) as unknown as Recebimento[]
}

export async function listarPagamentos(): Promise<Pagamento[]> {
  return (await pb.collection('pagamentos').getFullList({
    sort: 'vencimento',
    expand: 'obra,fornecedor',
  })) as unknown as Pagamento[]
}

export async function darBaixaRecebimento(
  id: string,
  valorRecebido: number,
  forma: string,
  data: string,
) {
  return (await pb.collection('recebimentos').update(id, {
    status: 'recebido',
    valor_recebido: valorRecebido,
    forma,
    recebido_em: data,
  })) as unknown as Recebimento
}

export async function pagarConta(id: string, valorPago: number, data: string) {
  return (await pb.collection('pagamentos').update(id, {
    status: 'pago',
    valor_pago: valorPago,
    pago_em: data,
  })) as unknown as Pagamento
}

/* ---------- projeção de caixa ---------- */

export type Janela = { rotulo: string; receber: number; pagar: number; saldo: number }

/**
 * Projeção por janela de dias. Só entra o que ainda não foi liquidado
 * e cujo vencimento cai na janela. Vencido conta na primeira janela.
 */
export function projetarCaixa(
  recebimentos: Recebimento[],
  pagamentos: Pagamento[],
): { janelas: Janela[]; atrasadoReceber: number; atrasadoPagar: number } {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const limites = [30, 60, 90]

  const janelas: Janela[] = limites.map((d, i) => ({
    rotulo: i === 0 ? 'Até 30 dias' : i === 1 ? '31 a 60 dias' : '61 a 90 dias',
    receber: 0,
    pagar: 0,
    saldo: 0,
  }))

  type Vec = { status?: string; valor: number; vencimento: string }

  let atrasadoReceber = 0
  let atrasadoPagar = 0

  const colocar = (item: Vec, campo: 'receber' | 'pagar') => {
    const venc = new Date(item.vencimento)
    const dias = Math.floor((venc.getTime() - hoje.getTime()) / 86400000)
    if (dias < 0) {
      janelas[0][campo] += item.valor
      if (campo === 'receber') atrasadoReceber += item.valor
      else atrasadoPagar += item.valor
      return
    }
    const idx = dias <= 30 ? 0 : dias <= 60 ? 1 : dias <= 90 ? 2 : -1
    if (idx >= 0) janelas[idx][campo] += item.valor
  }

  recebimentos
    .filter((r) => r.status !== 'recebido' && r.status !== 'cancelado')
    .forEach((r) => colocar(r, 'receber'))
  pagamentos
    .filter((p) => p.status !== 'pago' && p.status !== 'cancelado')
    .forEach((p) => colocar(p, 'pagar'))

  janelas.forEach((j) => {
    j.saldo = j.receber - j.pagar
  })

  return { janelas, atrasadoReceber, atrasadoPagar }
}

/** Recebido de fato por obra — para a margem separar previsto de realizado. */
export function recebidoPorObra(recebimentos: Recebimento[]): Map<string, number> {
  const mapa = new Map<string, number>()
  for (const r of recebimentos) {
    if (r.status !== 'recebido') continue
    mapa.set(r.obra, (mapa.get(r.obra) ?? 0) + (r.valor_recebido ?? r.valor))
  }
  return mapa
}
