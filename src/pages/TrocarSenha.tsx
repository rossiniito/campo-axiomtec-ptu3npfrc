/* Trocar a própria senha: pede a atual, valida contra o servidor, troca.

   Validação da senha atual no servidor (não dá para conferir no cliente —
   a senha fica só como hash). O hook também aceita "atual" vazio quando
   o token já provou quem é, mas aqui a tela sempre envia. */
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChevronLeft, KeyRound, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import pb from '@/lib/pocketbase/client'
import { eSessaoExpirada, useAuth } from '@/lib/auth'
import { getErrorMessage } from '@/lib/pocketbase/errors'

type Props = { onVoltar: () => void }

export default function TrocarSenha({ onVoltar }: Props) {
  const { usuario } = useAuth()
  const [atual, setAtual] = useState('')
  const [nova, setNova] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erroAtual, setErroAtual] = useState<string | null>(null)

  async function salvar() {
    setErroAtual(null)

    if (nova.length < 8) {
      toast.error('A nova senha precisa de pelo menos 8 caracteres')
      return
    }
    if (nova !== confirmar) {
      toast.error('A confirmação não confere com a nova senha')
      return
    }

    setSalvando(true)
    try {
      await pb.send('/backend/v1/acesso/trocar-senha', {
        method: 'POST',
        body: { senha_atual: atual, nova_senha: nova },
      })
      toast.success('Senha alterada', { description: 'Sua nova senha já está em uso.' })
      onVoltar()
    } catch (e) {
      if (eSessaoExpirada(e)) return
      const texto = getErrorMessage(e)
      if (texto.toLowerCase().includes('senha atual')) {
        setErroAtual('A senha atual não confere')
      } else {
        toast.error('Não foi possível trocar a senha', { description: texto })
      }
    }
    setSalvando(false)
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-10 border-b bg-background px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onVoltar} aria-label="Voltar">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              AxiomTec · Acesso
            </p>
            <h1 className="text-lg font-semibold">Trocar minha senha</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-4 px-4 py-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="h-4 w-4" /> Confirme quem você é
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Logado como <span className="font-medium">{usuario?.email}</span>. Digite sua senha
              atual para liberar a troca.
            </p>

            <div className="space-y-1.5">
              <Label className="text-xs">Senha atual</Label>
              <Input
                type="password"
                value={atual}
                onChange={(e) => setAtual(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
              {erroAtual && <p className="text-xs text-destructive">{erroAtual}</p>}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Nova senha</Label>
              <Input
                type="password"
                value={nova}
                onChange={(e) => setNova(e.target.value)}
                placeholder="Pelo menos 8 caracteres"
                autoComplete="new-password"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Confirmar nova senha</Label>
              <Input
                type="password"
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                placeholder="Repita a nova senha"
                autoComplete="new-password"
              />
            </div>

            <Button
              className="w-full gap-2"
              onClick={salvar}
              disabled={salvando || !atual || !nova}
            >
              {salvando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <KeyRound className="h-4 w-4" />
              )}
              Trocar senha
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
