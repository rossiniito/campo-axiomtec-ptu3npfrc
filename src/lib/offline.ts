/* Camada local-first: cache no dispositivo + fila de alterações pendentes.
   O PocketBase não tem sync offline nativo, então as escritas feitas sem
   conexão ficam nesta fila e são reenviadas quando o sinal volta. */
import pb from '@/lib/pocketbase/client'

const CACHE_KEY = 'campo:cache:v1'
const QUEUE_KEY = 'campo:fila:v1'

export type Obra = {
  id: string
  nome: string
  cliente?: string
  endereco?: string
  arquiteta?: string
  status?: string
}

export type Ambiente = {
  id: string
  obra: string
  nome: string
  ordem?: number
}

export type Item = {
  id: string
  obra: string
  ambiente: string
  nome: string
  concluido: boolean
  observacao?: string
  /** Nomes dos arquivos de foto do item (campo multi-arquivo no PocketBase). */
  foto?: string[] | string
  concluido_em?: string
  ordem?: number
}

export type Cache = {
  obras: Obra[]
  ambientes: Ambiente[]
  itens: Item[]
  atualizadoEm: string | null
}

export type Alteracao = {
  id: string
  itemId: string
  concluido: boolean
  observacao: string
}

const CACHE_VAZIO: Cache = { obras: [], ambientes: [], itens: [], atualizadoEm: null }

export function lerCache(): Cache {
  try {
    const bruto = localStorage.getItem(CACHE_KEY)
    if (!bruto) return CACHE_VAZIO
    return JSON.parse(bruto) as Cache
  } catch {
    return CACHE_VAZIO
  }
}

export function gravarCache(cache: Cache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch {
    /* sem espaço no dispositivo: segue com o que está em memória */
  }
}

export function lerFila(): Alteracao[] {
  try {
    const bruto = localStorage.getItem(QUEUE_KEY)
    if (!bruto) return []
    return JSON.parse(bruto) as Alteracao[]
  } catch {
    return []
  }
}

export function salvarFila(fila: Alteracao[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(fila))
  } catch {
    /* ignora */
  }
}

export function enfileirar(alteracao: Omit<Alteracao, 'id'>) {
  const fila = lerFila().filter((f) => f.itemId !== alteracao.itemId)
  fila.push({
    ...alteracao,
    id:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`,
  })
  salvarFila(fila)
  return fila
}

/** Sobrepõe as alterações pendentes sobre os dados vindos do servidor. */
export function comAlteracoesLocais(cache: Cache): Cache {
  const fila = lerFila()
  if (fila.length === 0) return cache
  const ultimaPorItem = new Map<string, Alteracao>()
  fila.forEach((f) => ultimaPorItem.set(f.itemId, f))
  return {
    ...cache,
    itens: cache.itens.map((item) => {
      const alt = ultimaPorItem.get(item.id)
      if (!alt) return item
      return { ...item, concluido: alt.concluido, observacao: alt.observacao }
    }),
  }
}

/** Baixa tudo do servidor e atualiza o cache local. */
export async function baixarTudo(): Promise<Cache> {
  const [obras, ambientes, itens] = await Promise.all([
    pb.collection('obras').getFullList({ sort: 'nome' }),
    pb.collection('ambientes').getFullList({ sort: 'ordem' }),
    pb.collection('itens').getFullList({ sort: 'ordem' }),
  ])
  const cache: Cache = {
    obras: obras as unknown as Obra[],
    ambientes: ambientes as unknown as Ambiente[],
    itens: itens as unknown as Item[],
    atualizadoEm: new Date().toISOString(),
  }
  const comLocais = comAlteracoesLocais(cache)
  gravarCache(comLocais)
  return comLocais
}

/** Reenvia a fila de alterações feitas offline. */
export async function sincronizar(): Promise<{ enviados: number; restantes: number }> {
  const fila = lerFila()
  if (fila.length === 0) return { enviados: 0, restantes: 0 }

  const ultimaPorItem = new Map<string, Alteracao>()
  fila.forEach((f) => ultimaPorItem.set(f.itemId, f))

  const restantes: Alteracao[] = []
  let enviados = 0

  for (const alteracao of fila) {
    if (ultimaPorItem.get(alteracao.itemId) !== alteracao) continue
    try {
      await pb.collection('itens').update(alteracao.itemId, {
        concluido: alteracao.concluido,
        observacao: alteracao.observacao,
        concluido_em: alteracao.concluido ? new Date().toISOString() : '',
      })
      enviados += 1
    } catch {
      restantes.push(alteracao)
    }
  }

  salvarFila(restantes)
  return { enviados, restantes: restantes.length }
}

/** Foto precisa de conexão: o arquivo não cabe na fila de texto. */
export async function enviarFoto(itemId: string, arquivo: File) {
  const form = new FormData()
  // "foto+" acrescenta o arquivo às fotos já anexadas ao item.
  form.append('foto+', arquivo)
  await pb.collection('itens').update(itemId, form)
}

/** Remove uma foto do item pelo nome do arquivo. Precisa de conexão. */
export async function apagarFoto(itemId: string, nomeArquivo: string) {
  // "foto-" remove só este arquivo do campo multi-arquivo.
  await pb.collection('itens').update(itemId, { 'foto-': [nomeArquivo] })
}

/** Nomes dos arquivos de foto do item, sempre como lista (aceita o formato antigo de um único arquivo). */
export function fotosDoItem(item: Item): string[] {
  if (!item.foto) return []
  return Array.isArray(item.foto) ? item.foto : [item.foto]
}

/** URL da miniatura de cada foto do item. */
export function urlsFotos(item: Item): { nome: string; miniatura: string; original: string }[] {
  try {
    return fotosDoItem(item).map((nome) => ({
      nome,
      miniatura: pb.files.getURL(item as never, nome, { thumb: '400x400' }),
      original: pb.files.getURL(item as never, nome),
    }))
  } catch {
    return []
  }
}
