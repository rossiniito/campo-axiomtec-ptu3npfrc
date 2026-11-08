import pb from '@/lib/pocketbase/client'
import type { Ambiente, Item, Obra } from '@/lib/offline'

export type Relatorio = {
  id: string
  obra: string
  titulo?: string
  nome_responsavel?: string
  observacoes?: string
  assinatura_cliente?: string
  assinatura_tecnico?: string
  assinado_em?: string
  enviado_em?: string
  total_itens?: number
  itens_concluidos?: number
  conteudo?: ConteudoRelatorio
  created?: string
}

export type ItemSnapshot = {
  ambiente: string
  nome: string
  concluido: boolean
  observacao?: string
  fotos: number
}

export type ConteudoRelatorio = {
  obra: string
  cliente?: string
  arquiteta?: string
  endereco?: string
  ambientes: { nome: string; concluidos: number; total: number }[]
  itens: ItemSnapshot[]
  geradoEm: string
}

function dataUrlParaArquivo(dataUrl: string, nome: string): File {
  const [cabecalho, base64] = dataUrl.split(',')
  const mime = cabecalho.match(/:(.*?);/)?.[1] ?? 'image/png'
  const bin = atob(base64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new File([bytes], nome, { type: mime })
}

export function montarConteudo(
  obra: Obra,
  ambientes: Ambiente[],
  itens: Item[],
): ConteudoRelatorio {
  return {
    obra: obra.nome,
    cliente: obra.cliente,
    arquiteta: obra.arquiteta,
    endereco: obra.endereco,
    ambientes: ambientes.map((a) => {
      const doAmb = itens.filter((i) => i.ambiente === a.id)
      return {
        nome: a.nome,
        concluidos: doAmb.filter((i) => i.concluido).length,
        total: doAmb.length,
      }
    }),
    itens: ambientes.flatMap((a) =>
      itens
        .filter((i) => i.ambiente === a.id)
        .sort((x, y) => (x.ordem ?? 0) - (y.ordem ?? 0))
        .map((i) => ({
          ambiente: a.nome,
          nome: i.nome,
          concluido: i.concluido,
          observacao: i.observacao,
          fotos: Array.isArray(i.foto) ? i.foto.length : i.foto ? 1 : 0,
        })),
    ),
    geradoEm: new Date().toISOString(),
  }
}

export async function salvarRelatorio(params: {
  obra: Obra
  ambientes: Ambiente[]
  itens: Item[]
  assinaturaCliente: string | null
  assinaturaTecnico: string | null
  nomeResponsavel: string
  observacoes: string
}): Promise<Relatorio> {
  const {
    obra,
    ambientes,
    itens,
    assinaturaCliente,
    assinaturaTecnico,
    nomeResponsavel,
    observacoes,
  } = params

  const conteudo = montarConteudo(obra, ambientes, itens)
  const form = new FormData()
  form.append('obra', obra.id)
  form.append('titulo', `Relatório de Implantação — ${obra.nome}`)
  form.append('nome_responsavel', nomeResponsavel)
  form.append('observacoes', observacoes)
  form.append('assinado_em', new Date().toISOString())
  form.append('total_itens', String(itens.length))
  form.append('itens_concluidos', String(itens.filter((i) => i.concluido).length))
  form.append('conteudo', JSON.stringify(conteudo))

  if (assinaturaCliente) {
    form.append(
      'assinatura_cliente',
      dataUrlParaArquivo(assinaturaCliente, 'assinatura-cliente.png'),
    )
  }
  if (assinaturaTecnico) {
    form.append(
      'assinatura_tecnico',
      dataUrlParaArquivo(assinaturaTecnico, 'assinatura-tecnico.png'),
    )
  }

  return (await pb.collection('relatorios').create(form)) as unknown as Relatorio
}

export function urlAssinatura(
  relatorio: Relatorio,
  campo: 'assinatura_cliente' | 'assinatura_tecnico',
) {
  const arquivo = relatorio[campo]
  if (!arquivo) return null
  try {
    return pb.files.getURL(relatorio as never, arquivo)
  } catch {
    return null
  }
}

export async function listarRelatorios(obraId: string): Promise<Relatorio[]> {
  return (await pb.collection('relatorios').getFullList({
    filter: pb.filter('obra = {:obra}', { obra: obraId }),
    sort: '-created',
  })) as unknown as Relatorio[]
}

export async function marcarEnviado(id: string) {
  await pb.collection('relatorios').update(id, { enviado_em: new Date().toISOString() })
}
