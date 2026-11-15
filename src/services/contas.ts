/* Contas PJ, aporte e a regra de "preciso de dinheiro?".

   Decisão do Rossini (15/11/2026): só PJ no sistema; e se precisar de aporte,
   ele quer ser avisado.

   A pergunta que esta regra responde: "o caixa cobre os próximos 30 dias
   sem furar o piso?" Se não cobre, o sistema diz quanto falta — o valor exato
   do aporte, não um "talvez precise". */
import pb from '@/lib/pocketbase/client'

export type Conta = {
  id: string
  nome: string
  banco?: string
  tipo?: 'corrente' | 'investimento' | 'capital_giro' | 'pagamento' | 'parceria'
  finalidade?: string
  saldo?: number
  saldo_em?: string
  valor_terceiro?: number
  tem_cartao?: boolean
  limite_cartao?: number
  fatura_aberta?: number
  fatura_venc?: string
  ativo?: boolean
  observacoes?: string
}

export type Aporte = {
  id: string
  valor: number
  data: string
  conta?: string
  motivo?: string
  status?: 'pendente' | 'feito' | 'cancelado'
  observacoes?: string
  expand?: { conta?: Conta }
}

export type ConfigFinanceiro = {
  id: string
  chave: string
  piso_caixa?: number
  custo_fixo_mensal?: number
  break_even_mensal?: number
}

export const ROTULO_TIPO_CONTA: Record<string, string> = {
  corrente: 'Conta corrente',
  investimento: 'Investimento / reserva',
  capital_giro: 'Capital de giro',
  pagamento: 'Conta de pagamento',
  parceria: 'Parceria',
}

/* ---------------- leitura ---------------- */

export async function listarContas(): Promise<Conta[]> {
  return (await pb.collection('contas').getFullList({ sort: 'nome' })) as unknown as Conta[]
}

export async function listarAportes(): Promise<Aporte[]> {
  return (await pb.collection('aportes').getFullList({
    sort: '-data',
    expand: 'conta',
  })) as unknown as Aporte[]
}

export async function carregarConfig(): Promise<ConfigFinanceiro | null> {
  const lista = (await pb.collection('config_financeiro').getFullList({
    filter: 'chave = "principal"',
  })) as unknown as ConfigFinanceiro[]
  return lista[0] ?? null
}

export async function salvarConta(id: string, dados: Record<string, unknown>) {
  return (await pb.collection('contas').update(id, dados)) as unknown as Conta
}

export async function criarAporte(dados: Record<string, unknown>) {
  return (await pb.collection('aportes').create(dados)) as unknown as Aporte
}

/* ---------------- as contas ---------------- */

/**
 * Dinheiro que é realmente da AxiomTec.
 * Saldo menos o que é de terceiro (RealHT) — o resto não pode ser gasto.
 */
export function caixaProprio(contas: Conta[]): number {
  return contas
    .filter((c) => c.ativo !== false)
    .reduce((soma, c) => soma + (c.saldo ?? 0) - (c.valor_terceiro ?? 0), 0)
}

/** Dinheiro de terceiro que está no caixa e vai ter de sair. */
export function caixaDeTerceiro(contas: Conta[]): number {
  return contas.reduce((soma, c) => soma + (c.valor_terceiro ?? 0), 0)
}

/** Faturas de cartão PJ em aberto (compra de equipamento cai aqui). */
export function faturasAbertas(contas: Conta[]): { total: number; itens: Conta[] } {
  const itens = contas.filter((c) => (c.fatura_aberta ?? 0) > 0)
  return { total: itens.reduce((s, c) => s + (c.fatura_aberta ?? 0), 0), itens }
}

/* ---------------- a regra do aporte ---------------- */

export type SituacaoCaixa = {
  caixaProprio: number
  deTerceiro: number
  faturas: number
  piso: number
  entra30: number
  sai30: number
  falta: number
  precisaAporte: boolean
  motivo: string
  severidade: 'ok' | 'atencao' | 'critico'
}

/**
 * Compara o que entra e sai nos próximos 30 dias contra o piso de caixa.
 *
 * Regra: (caixa próprio + o que entra em 30 dias − o que sai em 30 dias)
 *         não pode ficar abaixo do piso.
 * Se ficar, `falta` é exatamente quanto de aporte resolve.
 *
 * Fatura de cartão entra na saída junto com as contas a pagar? Não: a fatura
 * é pagamento do que já foi gasto e normalmente já está lançada como conta a
 * pagar. Somar as duas contaria o mesmo dinheiro duas vezes. Por isso a fatura
 * aparece na tela como informação, mas fica FORA da conta.
 */
export function avaliarAporte(
  contas: Conta[],
  config: ConfigFinanceiro | null,
  entra30: number,
  sai30: number,
): SituacaoCaixa {
  const proprio = caixaProprio(contas)
  const terceiro = caixaDeTerceiro(contas)
  const faturas = faturasAbertas(contas).total
  const piso = config?.piso_caixa ?? 0

  const disponivel = proprio + entra30 - sai30
  const falta = Math.max(0, piso - disponivel)
  const precisa = falta > 0

  let severidade: SituacaoCaixa['severidade'] = 'ok'
  let motivo = 'Caixa cobre os próximos 30 dias acima do piso.'

  if (precisa) {
    severidade = falta > piso * 0.5 ? 'critico' : 'atencao'
    motivo =
      'Faltam R$ ' +
      falta.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) +
      ' para fechar 30 dias sem furar o piso de R$ ' +
      piso.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) +
      '.'
  } else if (disponivel < piso * 1.1 && piso > 0) {
    severidade = 'atencao'
    motivo = 'Caixa passa do piso, mas com pouca folga (menos de 10%).'
  }

  return {
    caixaProprio: proprio,
    deTerceiro: terceiro,
    faturas,
    piso,
    entra30,
    sai30,
    falta,
    precisaAporte: precisa,
    motivo,
    severidade,
  }
}

/** Cria o pedido de aporte no banco, para ficar registrado que foi avisado. */
export async function registrarPedidoAporte(valor: number, motivo: string, contaId?: string) {
  return criarAporte({
    valor,
    data: new Date().toISOString(),
    motivo,
    conta: contaId || undefined,
    status: 'pendente',
  })
}

export const brl2 = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
