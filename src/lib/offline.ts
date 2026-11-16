/* Camada local-first: cache no dispositivo + fila de alterações pendentes.
   O PocketBase não tem sync offline nativo, então as escritas feitas sem
   conexão ficam nesta fila e são reenviadas quando o sinal volta. */
import pb from '@/lib/pocketbase/client'
import { urlArquivo } from '@/lib/files'
import { eSessaoExpirada } from '@/lib/auth'

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
  /** Posição do item dentro do ambiente (campo número). */
  ordem?: number
  /** Relação com a OS a que o item pertence. */
  ordem_servico?: string
  clickup_item_id?: string
  clickup_checklist_id?: string
  /** Tarefa criada manualmente na tela de execução (não veio de modelo). */
  avulso?: boolean
  /** Quem criou a tarefa avulsa (usuário). */
  criado_por?: string
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

/** Tarefa avulsa criada offline, esperando o sinal para virar registro. */
export type TarefaAvulsa = {
  id: string
  obra: string
  ambiente: string
  nome: string
  criadoPor: string
  /** OS em que a tarefa nasceu (quando a execução é por OS). */
  ordemServico?: string
}

const TAREFAS_KEY = 'campo:tarefas-avulsas:v1'

const CACHE_VAZIO: Cache = { obras: [], ambientes: [], itens: [], atualizadoEm: null }

/** Lista de tarefas avulsas ainda não enviadas ao servidor. */
export function lerTarefasAvulsas(): TarefaAvulsa[] {
  try {
    const bruto = localStorage.getItem(TAREFAS_KEY)
    if (!bruto) return []
    return JSON.parse(bruto) as TarefaAvulsa[]
  } catch {
    return []
  }
}

function salvarTarefasAvulsas(tarefas: TarefaAvulsa[]) {
  try {
    localStorage.setItem(TAREFAS_KEY, JSON.stringify(tarefas))
  } catch {
    /* ignora */
  }
}

function novoIdLocal(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `local-${Date.now()}-${Math.random()}`
}

/**
 * Guarda a tarefa avulsa localmente e devolve o "item" temporário
 * (id local, prefixo "local:") para a tela mostrar na hora — online ou não.
 */
export function adicionarTarefaLocal(
  obra: string,
  ambiente: string,
  nome: string,
  criadoPor: string,
  ordemServico?: string,
): Item {
  const tarefa: TarefaAvulsa = { id: novoIdLocal(), obra, ambiente, nome, criadoPor, ordemServico }
  const tarefas = lerTarefasAvulsas()
  tarefas.push(tarefa)
  salvarTarefasAvulsas(tarefas)
  return itemDaTarefa(tarefa)
}

/** Converte a tarefa pendente no formato de Item para a tela de execução. */
function itemDaTarefa(t: TarefaAvulsa): Item {
  return {
    id: `local:${t.id}`,
    obra: t.obra,
    ambiente: t.ambiente,
    nome: t.nome,
    concluido: false,
    avulso: true,
    ...(t.ordemServico ? { ordem_servico: t.ordemServico } : {}),
  }
}

/** Itens avulsos ainda pendentes, convertidos em Item para a tela. */
export function itensAvulsosLocais(obra: string): Item[] {
  return lerTarefasAvulsas()
    .filter((t) => t.obra === obra)
    .map(itemDaTarefa)
}

/** Remove a tarefa pendente da fila (após o envio bem-sucedido). */
function descartarTarefa(tarefaId: string) {
  salvarTarefasAvulsas(lerTarefasAvulsas().filter((t) => t.id !== tarefaId))
}

/** Envia as tarefas avulsas criadas offline; devolve quantas subiram. */
export async function enviarTarefasAvulsas(): Promise<number> {
  const tarefas = lerTarefasAvulsas()
  if (tarefas.length === 0) return 0
  const restantes: TarefaAvulsa[] = []
  let enviadas = 0
  for (const t of tarefas) {
    try {
      await pb.collection('itens').create({
        obra: t.obra,
        ambiente: t.ambiente,
        nome: t.nome,
        avulso: true,
        criado_por: t.criadoPor,
        ...(t.ordemServico ? { ordem_servico: t.ordemServico } : {}),
      })
      enviadas += 1
    } catch {
      restantes.push(t)
    }
  }
  salvarTarefasAvulsas(restantes)
  return enviadas
}

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
  // tarefas avulsas criadas offline sobem junto com as marcações
  let tarefasEnviadas = 0
  try {
    tarefasEnviadas = await enviarTarefasAvulsas()
  } catch {
    /* tenta de novo na próxima sincronização */
  }

  const fila = lerFila()
  if (fila.length === 0) return { enviados: tarefasEnviadas, restantes: 0 }

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
  return { enviados: enviados + tarefasEnviadas, restantes: restantes.length }
}

/**
 * Cria a tarefa avulsa na OS: online grava no servidor e baixa o cache;
 * offline (ou se a gravação falhar) guarda no aparelho e sobe depois,
 * junto com as marcações. Devolve o item temporário no caminho offline.
 */
export async function criarTarefaAvulsa(params: {
  obra: string
  ambiente: string
  ordemServico?: string
  nome: string
  criadoPor: string
  online: boolean
}): Promise<{ noServidor: boolean; erro?: unknown }> {
  const { obra, ambiente, ordemServico, nome, criadoPor, online } = params
  if (online) {
    try {
      await pb.collection('itens').create({
        obra,
        ambiente,
        nome,
        avulso: true,
        criado_por: criadoPor,
        ...(ordemServico ? { ordem_servico: ordemServico } : {}),
      })
      await baixarTudo()
      return { noServidor: true }
    } catch (erro) {
      // sessão vencida é tratada pela tela (eSessaoExpirada); o resto
      // (sem permissão, rede oscilando) cai para a fila offline
      if (eSessaoExpirada(erro)) return { noServidor: false, erro }
    }
  }
  adicionarTarefaLocal(obra, ambiente, nome, criadoPor)
  return { noServidor: false }
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

/** URL da miniatura de cada foto do item (com token, porque o arquivo é protegido). */
export function urlsFotos(item: Item): { nome: string; miniatura: string; original: string }[] {
  try {
    return fotosDoItem(item).map((nome) => ({
      nome,
      miniatura: urlArquivo(item as never, nome, { thumb: '400x400' }),
      original: urlArquivo(item as never, nome),
    }))
  } catch {
    return []
  }
}
