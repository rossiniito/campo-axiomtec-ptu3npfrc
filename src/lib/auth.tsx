/* Quem está logado e qual o perfil.

   O perfil vem do registro do usuário (`users.perfil`) e é gravado no
   servidor: a tela só esconde o que o servidor já bloqueia.

   Sessão: o token do PocketBase tem prazo e vence com o app aberto (PWA
   no celular fica dias aberto). Renovamos de tempo em tempo; se uma
   chamada voltar 401 mesmo assim, a sessão é limpa e o app volta ao
   login com o aviso "Sua sessão expirou" — em vez do erro cru. */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { ClientResponseError } from 'pocketbase'
import pb from '@/lib/pocketbase/client'

export type Perfil = 'gestor' | 'tecnico'

export type Usuario = {
  id: string
  email: string
  name?: string
  perfil?: Perfil
}

type Contexto = {
  usuario: Usuario | null
  autenticado: boolean
  carregando: boolean
  ehGestor: boolean
  entrar: (email: string, senha: string) => Promise<void>
  sair: () => void
}

const AuthCtx = createContext<Contexto | null>(null)

/** Aviso pendente de sessão expirada, lido pela tela de login. */
let sessaoExpirou = false

function marcarSessaoExpirada() {
  sessaoExpirou = true
}

/** Lê e limpa o aviso (a tela de login consome uma vez). */
export function consumirSessaoExpirada(): boolean {
  const valor = sessaoExpirou
  sessaoExpirou = false
  return valor
}

/** Encerra a sessão marcando que expirou — o Portao leva ao login. */
function encerrarSessaoExpirada() {
  marcarSessaoExpirada()
  pb.authStore.clear()
}

/** True quando o erro foi 401: limpa a sessão e avisa o login. */
export function eSessaoExpirada(erro: unknown): boolean {
  if (erro instanceof ClientResponseError && erro.status === 401) {
    encerrarSessaoExpirada()
    return true
  }
  return false
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(() =>
    pb.authStore.isValid ? (pb.authStore.record as unknown as Usuario) : null,
  )
  const [autenticado, setAutenticado] = useState(pb.authStore.isValid)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    const cancelar = pb.authStore.onChange((_token, record) => {
      setUsuario(pb.authStore.isValid ? (record as unknown as Usuario) : null)
      setAutenticado(pb.authStore.isValid)
    })

    const renovar = async () => {
      if (!pb.authStore.isValid) return
      try {
        await pb.collection('users').authRefresh()
      } catch {
        // token vencido ou revogado: volta ao login com o aviso
        encerrarSessaoExpirada()
      }
    }

    if (pb.authStore.isValid) {
      renovar().finally(() => setCarregando(false))
      // renova bem antes do prazo do token (padrão do PocketBase: 5 dias)
      const intervalo = setInterval(() => void renovar(), 12 * 60 * 60 * 1000)
      window.addEventListener('online', renovar)
      return () => {
        clearInterval(intervalo)
        window.removeEventListener('online', renovar)
        cancelar()
      }
    } else {
      if (pb.authStore.record) pb.authStore.clear()
      setCarregando(false)
    }

    return cancelar
  }, [])

  async function entrar(email: string, senha: string) {
    await pb.collection('users').authWithPassword(email.trim(), senha)
  }

  function sair() {
    pb.authStore.clear()
  }

  return (
    <AuthCtx.Provider
      value={{
        usuario,
        autenticado,
        carregando,
        ehGestor: usuario?.perfil === 'gestor',
        entrar,
        sair,
      }}
    >
      {children}
    </AuthCtx.Provider>
  )
}

export function useAuth(): Contexto {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('useAuth precisa estar dentro de AuthProvider')
  return ctx
}
