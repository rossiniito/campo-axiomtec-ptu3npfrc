/* Quem está logado e qual o perfil.

   O perfil vem do registro do usuário (`users.perfil`) e é gravado no
   servidor: a tela só esconde o que o servidor já bloqueia. */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
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

    if (pb.authStore.isValid) {
      pb.collection('users')
        .authRefresh()
        .catch(() => pb.authStore.clear())
        .finally(() => setCarregando(false))
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
