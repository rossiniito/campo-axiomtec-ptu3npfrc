/* Endereço de arquivo protegido.

   Desde que foto e assinatura passaram a ser `protected`, o endereço do
   arquivo sozinho não abre nada: o PocketBase exige um token de arquivo
   (`/api/files/token`). Este módulo guarda esse token em memória e monta a
   URL com ele, para as telas continuarem simples e síncronas.

   Sem token renovado, a URL volta sem ele — a imagem falha e a tela mostra o
   espaço vazio, em vez de quebrar a página inteira. */
import pb from '@/lib/pocketbase/client'

let token = ''
let obtidoEm = 0

const VALIDADE_MS = 30 * 60 * 1000

/** Renova o token de arquivo se estiver velho ou ausente. */
export async function garantirTokenArquivo(): Promise<string> {
  const agora = Date.now()
  if (token && agora - obtidoEm < VALIDADE_MS) return token
  try {
    token = await pb.files.getToken()
    obtidoEm = agora
  } catch {
    token = ''
  }
  return token
}

/** Esquece o token (usado ao sair). */
export function limparTokenArquivo() {
  token = ''
  obtidoEm = 0
}

/** URL do arquivo, com o token quando já temos um. */
export function urlArquivo(
  registro: { id: string; collectionId?: string; collectionName?: string },
  nome: string,
  opcoes: Record<string, unknown> = {},
): string {
  if (!nome) return ''
  const extras = token ? { ...opcoes, token } : opcoes
  try {
    return pb.files.getURL(registro as never, nome, extras)
  } catch {
    return ''
  }
}
