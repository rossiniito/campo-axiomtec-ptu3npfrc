/* Financeiro: despesa de campo e a margem por obra.

   A conta que o Bling não faz:
     receita aprovada  −  equipamentos da obra  −  despesas aprovadas  =  margem

   Por que não somar "compras" além de equipamentos: o valor de compra do
   equipamento JÁ é o custo do material. Somar os dois contaria duas vezes. */
import pb from '@/lib/pocketbase/client'

export type Despesa = {
  id: string
  descricao: string
  tipo?: string
  valor: number
  data?: string
  obra: string
  tecnico: string
  comprovante?: string[]
  observacoes?: string
  status?: 'pendente' | 'aprovado' | 'reembolsado' | 'recusado'
  aprovado_por?: string
  aprovado_em?: string
  motivo_recusa?: string
  pago_em?: string
  expand?: {
    obra?: { id: string; nome: string }
    tecnico?: { id: string; name?: string; email: string }
  }
}

export const ROTULO_DESPESA: Record<string, string> = {
  combustivel: 'Combustível',
  alimentacao: 'Alimentação',
  pedagio: 'Pedágio',
  hospedagem: 'Hospedagem',
  material_consumo: 'Material de consumo',
  terceiros: 'Terceiros',
  frete: 'Frete',
  ferramenta: 'Ferramenta',
  outro: 'Outro',
}

export const ROTULO_STATUS_DESPESA: Record<string, string> = {
  pendente: 'Aguardando aprovação',
  aprovado: 'Aprovada',
  reembolsado: 'Reembolsada',
  recusado: 'Recusada',
}

/* ---------------- despesas ---------------- */

export async function listarDespesas(): Promise<Despesa[]> {
  return (await pb.collection('despesas').getFullList({
    sort: '-data,-created',
    expand: 'obra,tecnico',
  })) as unknown as Despesa[]
}

export async function listarMinhasDespesas(usuarioId: string): Promise<Despesa[]> {
  return (await pb.collection('despesas').getFullList({
    filter: `tecnico = "${usuarioId}"`,
    sort: '-data,-created',
    expand: 'obra',
  })) as unknown as Despesa[]
}

export async function criarDespesa(dados: Record<string, unknown>) {
  return (await pb.collection('despesas').create(dados)) as unknown as Despesa
}

export async function aprovarDespesa(id: string, gestorId: string) {
  return (await pb.collection('despesas').update(id, {
    status: 'aprovado',
    aprovado_por: gestorId,
    aprovado_em: new Date().toISOString(),
  })) as unknown as Despesa
}

export async function recusarDespesa(id: string, gestorId: string, motivo: string) {
  return (await pb.collection('despesas').update(id, {
    status: 'recusado',
    aprovado_por: gestorId,
    aprovado_em: new Date().toISOString(),
    motivo_recusa: motivo,
  })) as unknown as Despesa
}

export async function marcarReembolsada(id: string) {
  return (await pb.collection('despesas').update(id, {
    status: 'reembolsado',
    pago_em: new Date().toISOString(),
  })) as unknown as Despesa
}

/** Total a reembolsar (aprovado, ainda não pago). */
export function totalAReembolsar(lista: Despesa[]): number {
  return lista.filter((d) => d.status === 'aprovado').reduce((soma, d) => soma + (d.valor ?? 0), 0)
}

/* ---------------- margem por obra ---------------- */

export type MargemObra = {
  obraId: string
  obra: string
  cliente: string
  receita: number // orçamentos aprovados
  equipamentos: number // soma de equipamentos.valor_compra
  despesas: number // despesas aprovadas + reembolsadas
  custo: number
  margem: number
  margemPct: number
  temReceita: boolean
}

type Orcamento = { valor?: number; status?: string; obra?: string; cliente?: string }
type Equip = { valor_compra?: number; obra?: string }

/**
 * Cruza orçamento aprovado + equipamento + despesa e devolve a margem por obra.
 * Obra sem orçamento aprovado entra com receita 0 e sinaliza temReceita=false:
 * não é prejuízo, é dado faltando. Mostrar como prejuízo seria mentir.
 */
export function calcularMargem(
  obras: { id: string; nome: string; cliente?: string }[],
  orcamentos: Orcamento[],
  equipamentos: Equip[],
  despesas: Despesa[],
): MargemObra[] {
  const receitaPorObra = new Map<string, number>()
  for (const o of orcamentos) {
    if (o.status !== 'aprovado' || !o.obra) continue
    receitaPorObra.set(o.obra, (receitaPorObra.get(o.obra) ?? 0) + (o.valor ?? 0))
  }

  const equipPorObra = new Map<string, number>()
  for (const e of equipamentos) {
    if (!e.obra) continue
    equipPorObra.set(e.obra, (equipPorObra.get(e.obra) ?? 0) + (e.valor_compra ?? 0))
  }

  const despesaPorObra = new Map<string, number>()
  for (const d of despesas) {
    if (d.status === 'recusado' || d.status === 'pendente') continue
    despesaPorObra.set(d.obra, (despesaPorObra.get(d.obra) ?? 0) + (d.valor ?? 0))
  }

  return obras
    .map((obra) => {
      const receita = receitaPorObra.get(obra.id) ?? 0
      const equip = equipPorObra.get(obra.id) ?? 0
      const desp = despesaPorObra.get(obra.id) ?? 0
      const custo = equip + desp
      const margem = receita - custo
      return {
        obraId: obra.id,
        obra: obra.nome,
        cliente: obra.cliente ?? '',
        receita,
        equipamentos: equip,
        despesas: desp,
        custo,
        margem,
        margemPct: receita > 0 ? Math.round((margem / receita) * 1000) / 10 : 0,
        temReceita: receita > 0,
      }
    })
    .filter((m) => m.receita > 0 || m.custo > 0)
    .sort((a, b) => b.margem - a.margem)
}

/** Carrega tudo e calcula. Usado pela tela Financeiro. */
export async function carregarMargem(): Promise<{
  linhas: MargemObra[]
  despesas: Despesa[]
  totais: { receita: number; custo: number; margem: number; pendente: number }
}> {
  const [obras, orcamentos, equipamentos, despesas] = await Promise.all([
    pb.collection('obras').getFullList({ sort: 'nome' }),
    pb.collection('orcamentos').getFullList(),
    pb.collection('equipamentos').getFullList(),
    listarDespesas(),
  ])

  const linhas = calcularMargem(
    obras as unknown as { id: string; nome: string; cliente?: string }[],
    orcamentos as unknown as Orcamento[],
    equipamentos as unknown as Equip[],
    despesas,
  )

  const receita = linhas.reduce((s, l) => s + l.receita, 0)
  const custo = linhas.reduce((s, l) => s + l.custo, 0)
  const pendente = despesas
    .filter((d) => d.status === 'pendente')
    .reduce((s, d) => s + (d.valor ?? 0), 0)

  return { linhas, despesas, totais: { receita, custo, margem: receita - custo, pendente } }
}

export const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
