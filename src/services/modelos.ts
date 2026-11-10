/* Modelos de checklist: o jeito AxiomTec de instalar, guardado uma vez.
   Cada modelo é uma lista de ambientes com seus itens. */
import pb from '@/lib/pocketbase/client'

export type BlocoModelo = {
  ambiente: string
  itens: string[]
}

export type Modelo = {
  id: string
  nome: string
  descricao?: string
  categoria?: 'automacao' | 'av' | 'redes' | 'cftv' | 'video_porteiro' | 'outro'
  ativo?: boolean
  estrutura: BlocoModelo[]
  created?: string
}

export const ROTULO_CATEGORIA: Record<string, string> = {
  automacao: 'Automação',
  av: 'Áudio e vídeo',
  redes: 'Redes',
  cftv: 'CFTV',
  video_porteiro: 'Vídeo porteiro',
  outro: 'Outro',
}

export function totalDeItens(estrutura: BlocoModelo[]): number {
  return estrutura.reduce((soma, b) => soma + (b.itens?.length ?? 0), 0)
}

export async function listarModelos(): Promise<Modelo[]> {
  const lista = (await pb.collection('modelos').getFullList({
    sort: 'nome',
  })) as unknown as Modelo[]
  // o PocketBase devolve JSON já convertido; garante o formato se vier texto
  return lista.map((m) => ({
    ...m,
    estrutura: typeof m.estrutura === 'string' ? JSON.parse(m.estrutura) : (m.estrutura ?? []),
  }))
}

export async function criarModelo(dados: {
  nome: string
  descricao?: string
  categoria?: string
  estrutura: BlocoModelo[]
}): Promise<Modelo> {
  return (await pb.collection('modelos').create({
    ...dados,
    ativo: true,
    estrutura: JSON.stringify(dados.estrutura),
  })) as unknown as Modelo
}

export async function atualizarModelo(
  id: string,
  dados: { nome?: string; descricao?: string; categoria?: string; estrutura?: BlocoModelo[] },
): Promise<Modelo> {
  const corpo: Record<string, unknown> = { ...dados }
  if (dados.estrutura) corpo.estrutura = JSON.stringify(dados.estrutura)
  return (await pb.collection('modelos').update(id, corpo)) as unknown as Modelo
}

export async function excluirModelo(id: string) {
  await pb.collection('modelos').delete(id)
}

/** Aplica o modelo numa OS: cria os itens aqui e o checklist na tarefa do ClickUp. */
export async function aplicarModeloNaOS(
  ordemId: string,
  modeloId: string,
): Promise<{
  ambientes: number
  itens: number
  clickup:
    | 'criado'
    | 'parcial'
    | 'sem_token'
    | 'sem_tarefa_vinculada'
    | 'ja_existia'
    | 'nao_solicitado'
  avisos: string[]
}> {
  // pb.send leva o token da sessão: a rota exige login
  return (await pb.send('/backend/v1/os/aplicar-modelo', {
    method: 'POST',
    body: { ordem_id: ordemId, modelo_id: modeloId },
  })) as {
    ambientes: number
    itens: number
    clickup:
      | 'criado'
      | 'parcial'
      | 'sem_token'
      | 'sem_tarefa_vinculada'
      | 'ja_existia'
      | 'nao_solicitado'
    avisos: string[]
  }
}
