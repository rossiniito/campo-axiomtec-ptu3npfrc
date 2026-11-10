/* Tela de entrada.

   Dois estados: sistema novo (cria o gestor) e sistema já configurado
   (login normal). O técnico entra com o e-mail e a senha que o gestor
   cadastrou — não existe autocadastro. */
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Lock, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { criarPrimeiroGestor, statusDoAcesso } from '@/services/acesso'

export default function Login() {
  const { entrar } = useAuth()
  const [verificando, setVerificando] = useState(true)
  const [configurado, setConfigurado] = useState(true)

  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    statusDoAcesso()
      .then(setConfigurado)
      .catch(() => setConfigurado(true))
      .finally(() => setVerificando(false))
  }, [])

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setSalvando(true)
    try {
      if (!configurado) {
        await criarPrimeiroGestor({ nome, email, password: senha })
        setConfigurado(true)
      }
      await entrar(email, senha)
    } catch {
      setErro('Não foi possível entrar. Confira e-mail e senha e tente de novo.')
    }
    setSalvando(false)
  }

  if (verificando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="pb-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            AxiomTec · Campo
          </p>
          <CardTitle className="flex items-center gap-2 text-xl">
            {configurado ? <Lock className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
            {configurado ? 'Entrar' : 'Configurar acesso'}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {configurado
              ? 'Use o e-mail e a senha da sua conta.'
              : 'Primeiro acesso: crie a conta do gestor. Depois é ele quem cadastra a equipe.'}
          </p>
        </CardHeader>

        <CardContent>
          <form onSubmit={enviar} className="space-y-3">
            {!configurado && (
              <div className="space-y-1.5">
                <Label className="text-xs">Seu nome</Label>
                <Input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex.: Rossini"
                  autoComplete="name"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">E-mail</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@axiomtec.com.br"
                autoComplete="email"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Senha</Label>
              <Input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder={configurado ? 'Sua senha' : 'Pelo menos 8 caracteres'}
                autoComplete={configurado ? 'current-password' : 'new-password'}
                minLength={8}
                required
              />
            </div>

            {erro && <p className="text-xs text-destructive">{erro}</p>}

            <Button type="submit" className="w-full gap-2" disabled={salvando}>
              {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
              {configurado ? 'Entrar' : 'Criar conta e entrar'}
            </Button>
          </form>

          {configurado && (
            <p className="mt-3 text-center text-[11px] text-muted-foreground">
              Esqueceu a senha? Peça ao gestor para redefinir.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
