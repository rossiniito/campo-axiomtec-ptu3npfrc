/* Ordens de serviço: a camada que o técnico vê no dia.
   A OS é criada pelo backend a partir da tarefa de Instalação do ClickUp;
   aqui ela é lida do PocketBase junto com os itens do checklist. */
import pb from '@/lib/pocketbase/client'

export type Ordem = {
  id: string
  obra: string
  numero: string
  status?: 'aberta' | 'em_execucao' | 'concluida' | 'cancelada'
  clickup_task_id?: string
  clickup_task_url?: string
  clickup_status?: string
  descricao?: string
  tecnico?: string
  data_prevista?: string
  checkin_em?: string
  checkout_em?: string
  pendencia_cliente?: string
  sincronizada_em?: string
  ultimo_erro_sync?: string
  observacao_sync?: string
  created?: string
  expand?: { obra?: { id: string; nome: string; cliente?: string; endereco?: string } }
}

export const ROTULO_STATUS: Record<string, string> = {
  aberta: 'Aberta',
  em_execucao: 'Em execução',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
}

export async function listarOrdens(): Promise<Ordem[]> {
  return (await pb.collection('ordens').getFullList({
    sort: '-created',
    expand: 'obra',
  })) as unknown as Ordem[]
}

export async function obterOrdem(id: string): Promise<Ordem> {
  return (await pb.collection('ordens').getOne(id, { expand: 'obra' })) as unknown as Ordem
}

export async function atualizarOrdem(id: string, dados: Record<string, unknown>) {
  return (await pb.collection('ordens').update(id, dados)) as unknown as Ordem
}

/** Marca entrada/saída do técnico — é o check-in que depois vira hora no ClickUp. */
export async function registrarCheckin(id: string, tecnico: string) {
  return atualizarOrdem(id, {
    checkin_em: new Date().toISOString(),
    tecnico,
    status: 'em_execucao',
  })
}

export async function registrarCheckout(id: string) {
  return atualizarOrdem(id, { checkout_em: new Date().toISOString() })
}

/** Dispara a busca de novas OS no ClickUp (roda no backend, que guarda o token). */
export async function puxarDoClickUp(): Promise<{
  lidas: number
  os_criadas: number
  ja_existiam: number
  detalhe?: unknown[]
}> {
  const res = await fetch(`${pb.baseUrl}/backend/v1/os/puxar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  const dados = await res.json()
  if (!res.ok) throw new Error(dados?.error ?? `Falha ao buscar (HTTP ${res.status})`)
  return dados
}
