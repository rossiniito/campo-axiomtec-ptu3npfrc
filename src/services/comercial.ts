/* Comercial: orçamentos, pipeline e aprovação. */
import pb from '@/lib/pocketbase/client'
import type { Ordem } from './ordens'

export type Orcamento = {
  id: string
  cliente: string
  arquiteta?: string
  escopo?: string
  valor?: number
  status: 'rascunho' | 'enviado' | 'negociando' | 'aprovado' | 'perdido'
  motivo_perda?: string
  data_aprovacao?: string
  obra?: string
  expand?: { obra?: { id: string; nome: string } }
  created?: string
}

export const ROTULO_STATUS_ORC: Record<string, string> = {
  rascunho: 'Rascunho',
  enviado: 'Enviado',
  negociando: 'Negociando',
  aprovado: 'Aprovado',
  perdido: 'Perdido',
}

export async function listarOrcamentos(): Promise<Orcamento[]> {
  return (await pb.collection('orcamentos').getFullList({
    sort: '-created',
    expand: 'obra',
  })) as unknown as Orcamento[]
}

export async function criarOrcamento(dados: {
  cliente: string
  arquiteta?: string
  escopo?: string
  valor?: number
  status?: string
}): Promise<Orcamento> {
  return (await pb.collection('orcamentos').create(dados)) as unknown as Orcamento
}

export async function atualizarOrcamento(id: string, dados: Record<string, unknown>) {
  return (await pb.collection('orcamentos').update(id, dados)) as unknown as Orcamento
}

export async function excluirOrcamento(id: string) {
  await pb.collection('orcamentos').delete(id)
}

/** Aprova: cria obra + primeira OS no mesmo sistema. */
export async function aprovarOrcamento(
  id: string,
): Promise<{ orcamento: string; obra: string; os: string; os_id: string }> {
  const res = await fetch(`${pb.baseUrl}/backend/v1/orcamento/aprovar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orcamento_id: id }),
  })
  const dados = await res.json()
  if (!res.ok) throw new Error(dados?.error ?? `Falha ao aprovar (HTTP ${res.status})`)
  return dados
}

export type ResumoComercial = {
  abertos: number
  aprovados: number
  perdidos: number
  conversao: number
  pipelineAberto: number
  ganhoMes: number
}

export function resumir(lista: Orcamento[], agora = new Date()): ResumoComercial {
  const abertos = lista.filter((o) => ['rascunho', 'enviado', 'negociando'].includes(o.status))
  const aprovados = lista.filter((o) => o.status === 'aprovado')
  const perdidos = lista.filter((o) => o.status === 'perdido')
  const decididos = aprovados.length + perdidos.length

  const mes = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`
  const ganhoMes = aprovados
    .filter((o) => (o.data_aprovacao ?? '').startsWith(mes))
    .reduce((s, o) => s + (o.valor ?? 0), 0)

  return {
    abertos: abertos.length,
    aprovados: aprovados.length,
    perdidos: perdidos.length,
    conversao: decididos > 0 ? Math.round((aprovados.length / decididos) * 100) : 0,
    pipelineAberto: abertos.reduce((s, o) => s + (o.valor ?? 0), 0),
    ganhoMes,
  }
}

export type { Ordem }
