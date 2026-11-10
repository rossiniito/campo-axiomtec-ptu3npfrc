/* Chamadas das rotas de acesso e da equipe. */
import pb from '@/lib/pocketbase/client'
import type { Perfil, Usuario } from '@/lib/auth'

export async function statusDoAcesso(): Promise<boolean> {
  const r = (await pb.send('/backend/v1/acesso/status', { method: 'GET' })) as {
    configurado?: boolean
  }
  return r?.configurado === true
}

export async function criarPrimeiroGestor(dados: {
  nome: string
  email: string
  password: string
}) {
  await pb.send('/backend/v1/acesso/bootstrap', { method: 'POST', body: dados })
}

export async function criarUsuario(dados: {
  nome: string
  email: string
  password: string
  perfil: Perfil
}) {
  return (await pb.send('/backend/v1/acesso/criar-usuario', {
    method: 'POST',
    body: dados,
  })) as Usuario
}

export async function listarUsuarios(): Promise<Usuario[]> {
  return (await pb.collection('users').getFullList({ sort: 'name' })) as unknown as Usuario[]
}

export async function excluirUsuario(id: string) {
  await pb.collection('users').delete(id)
}

/** Define quem responde por cada obra. */
export async function definirEquipeDaObra(obraId: string, tecnicos: string[]) {
  return await pb.send('/backend/v1/obras/equipe', {
    method: 'POST',
    body: { obra_id: obraId, tecnicos },
  })
}

export type ObraEquipe = { id: string; nome: string; tecnicos?: string[] }

export async function listarObras(): Promise<ObraEquipe[]> {
  return (await pb.collection('obras').getFullList({ sort: 'nome' })) as unknown as ObraEquipe[]
}
