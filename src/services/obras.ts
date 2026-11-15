/* Situação das obras: onde cada cliente está agora.
   O status da obra é o que o escritório acompanha; a OS é o dia do técnico. */
import pb from '@/lib/pocketbase/client'

export type StatusObra =
  | 'aguardando'
  | 'aguardando_terceiros'
  | 'executando'
  | 'ajustes_finais'
  | 'finalizado'
  | 'entregue'
  | 'visita_tecnica'

export type Obra = {
  id: string
  nome: string
  cliente?: string
  endereco?: string
  arquiteta?: string
  status?: StatusObra
  situacao?: string
  status_em?: string
  cliente_ref?: string
  tecnicos?: string[]
  created?: string
  updated?: string
}

/** Rótulo e cor de cada status, na ordem em que a obra anda. */
export const STATUS_OBRA: Record<StatusObra, { rotulo: string; cor: string; descricao: string }> = {
  aguardando: {
    rotulo: 'Aguardando',
    cor: 'bg-slate-100 text-slate-700 border-slate-200',
    descricao: 'Contratada, ainda sem data de início',
  },
  aguardando_terceiros: {
    rotulo: 'Aguardando terceiros',
    cor: 'bg-amber-100 text-amber-800 border-amber-200',
    descricao: 'Depende de outra equipe ou do cliente para começar',
  },
  executando: {
    rotulo: 'Em execução',
    cor: 'bg-blue-100 text-blue-800 border-blue-200',
    descricao: 'Equipe AxiomTec trabalhando na obra',
  },
  ajustes_finais: {
    rotulo: 'Ajustes finais',
    cor: 'bg-orange-100 text-orange-800 border-orange-200',
    descricao: 'Instalação feita, faltam pequenos ajustes',
  },
  finalizado: {
    rotulo: 'Finalizado',
    cor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    descricao: 'Serviço concluído, aguardando entrega formal',
  },
  entregue: {
    rotulo: 'Entregue',
    cor: 'bg-emerald-600 text-white border-emerald-700',
    descricao: 'Entregue ao cliente',
  },
  visita_tecnica: {
    rotulo: 'Visita técnica',
    cor: 'bg-violet-100 text-violet-800 border-violet-200',
    descricao: 'Visita pontual, sem obra em andamento',
  },
}

/** Ordem de exibição: o que exige atenção primeiro. */
export const ORDEM_STATUS: StatusObra[] = [
  'executando',
  'ajustes_finais',
  'aguardando_terceiros',
  'visita_tecnica',
  'aguardando',
  'finalizado',
  'entregue',
]

export async function listarObras(): Promise<Obra[]> {
  return (await pb.collection('obras').getFullList({
    sort: '-updated',
  })) as unknown as Obra[]
}

export async function atualizarObra(id: string, dados: Record<string, unknown>) {
  return (await pb.collection('obras').update(id, dados)) as unknown as Obra
}

/** Muda o status guardando quando aconteceu. */
export async function mudarStatusObra(id: string, status: StatusObra, situacao?: string) {
  return atualizarObra(id, {
    status,
    ...(situacao !== undefined ? { situacao } : {}),
    status_em: new Date().toISOString(),
  })
}

export async function criarObra(dados: {
  nome: string
  cliente?: string
  arquiteta?: string
  endereco?: string
  status?: StatusObra
  situacao?: string
}) {
  return (await pb.collection('obras').create({
    ...dados,
    status_em: new Date().toISOString(),
  })) as unknown as Obra
}

/** Conta quantas obras há em cada status, para o resumo do topo. */
export function contarPorStatus(obras: Obra[]): Record<string, number> {
  const contagem: Record<string, number> = {}
  for (const obra of obras) {
    const s = obra.status ?? 'aguardando'
    contagem[s] = (contagem[s] ?? 0) + 1
  }
  return contagem
}
