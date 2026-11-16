/* Equipe: quem entra no sistema e quem responde por qual obra.

   É a única tela onde se cria usuário. O técnico não vê esta aba — e se
   tentar pela API, o servidor recusa. */
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { ChevronLeft, KeyRound, Loader2, Plus, Trash2, UserCheck, Users, X } from 'lucide-react'
import { toast } from 'sonner'
import { eSessaoExpirada, type Usuario } from '@/lib/auth'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import TrocarSenha from './TrocarSenha'
import {
  criarUsuario,
  definirEquipeDaObra,
  excluirUsuario,
  listarObras,
  listarUsuarios,
  type ObraEquipe,
} from '@/services/acesso'

type Props = { onVoltar: () => void }

export default function Equipe({ onVoltar }: Props) {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [obras, setObras] = useState<ObraEquipe[]>([])
  const [carregando, setCarregando] = useState(true)
  const [novo, setNovo] = useState(false)
  const [verTrocarSenha, setVerTrocarSenha] = useState(false)

  async function carregar() {
    try {
      const [u, o] = await Promise.all([listarUsuarios(), listarObras()])
      setUsuarios(u)
      setObras(o)
    } catch (e) {
      if (!eSessaoExpirada(e)) toast.error('Não foi possível carregar a equipe')
    }
    setCarregando(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  const tecnicos = usuarios.filter((u) => u.perfil === 'tecnico')

  async function alternarTecnico(obra: ObraEquipe, usuarioId: string, marcar: boolean) {
    const atuais = obra.tecnicos ?? []
    const novos = marcar ? [...atuais, usuarioId] : atuais.filter((id) => id !== usuarioId)
    setObras((atual) => atual.map((o) => (o.id === obra.id ? { ...o, tecnicos: novos } : o)))
    try {
      await definirEquipeDaObra(obra.id, novos)
      toast.success(`Equipe de ${obra.nome} atualizada`)
    } catch (e) {
      if (eSessaoExpirada(e)) return
      toast.error('Não foi possível salvar', { description: getErrorMessage(e) })
      await carregar()
    }
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {verTrocarSenha && <TrocarSenha onVoltar={() => setVerTrocarSenha(false)} />}

      <header className="sticky top-0 z-10 border-b bg-background px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onVoltar} aria-label="Voltar">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              AxiomTec · Acesso
            </p>
            <h1 className="text-lg font-semibold">Equipe</h1>
          </div>
          <Button size="sm" className="gap-1" onClick={() => setNovo(true)}>
            <Plus className="h-4 w-4" /> Pessoa
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-5 px-4 py-4">
        {carregando && (
          <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>
        )}

        <Button variant="outline" className="w-full gap-2" onClick={() => setVerTrocarSenha(true)}>
          <KeyRound className="h-4 w-4" /> Trocar minha senha
        </Button>

        {/* ---------- pessoas ---------- */}
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Users className="h-4 w-4" /> Quem entra no sistema
          </h2>

          {usuarios.map((u) => (
            <div
              key={u.id}
              className="flex items-center justify-between gap-2 rounded-lg border bg-card p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{u.name || u.email}</p>
                <p className="truncate text-xs text-muted-foreground">{u.email}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge
                  variant={u.perfil === 'gestor' ? 'default' : 'secondary'}
                  className="text-xs"
                >
                  {u.perfil === 'gestor' ? 'Gestor' : 'Técnico'}
                </Badge>
                {u.perfil !== 'gestor' && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive"
                    aria-label="Remover acesso"
                    onClick={async () => {
                      if (!confirm(`Remover o acesso de ${u.name || u.email}?`)) return
                      try {
                        await excluirUsuario(u.id)
                        await carregar()
                        toast.success('Acesso removido')
                      } catch (e) {
                        if (eSessaoExpirada(e)) return
                        toast.error('Não foi possível remover', { description: getErrorMessage(e) })
                      }
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </section>

        {/* ---------- obra x técnico ---------- */}
        <section className="space-y-2 pt-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <UserCheck className="h-4 w-4" /> Quem responde por qual obra
          </h2>
          <p className="text-xs text-muted-foreground">
            O técnico vê só as obras marcadas aqui — checklist, fotos e relatório.
          </p>

          {obras.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="p-4 text-sm text-muted-foreground">
                Nenhuma obra cadastrada ainda.
              </CardContent>
            </Card>
          )}

          {obras.map((obra) => (
            <Card key={obra.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{obra.nome}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {tecnicos.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Cadastre um técnico para poder atribuir esta obra.
                  </p>
                )}
                {tecnicos.map((t) => {
                  const marcado = (obra.tecnicos ?? []).includes(t.id)
                  return (
                    <label
                      key={t.id}
                      className="flex cursor-pointer items-center gap-3 rounded-md border p-2 text-sm"
                    >
                      <Checkbox
                        checked={marcado}
                        onCheckedChange={(v) => alternarTecnico(obra, t.id, v === true)}
                      />
                      <span className="min-w-0 flex-1 truncate">{t.name || t.email}</span>
                    </label>
                  )
                })}
              </CardContent>
            </Card>
          ))}
        </section>
      </main>

      {novo && (
        <FormPessoa
          onFechar={() => setNovo(false)}
          onSalvo={async () => {
            setNovo(false)
            await carregar()
          }}
        />
      )}
    </div>
  )
}

function FormPessoa({ onFechar, onSalvo }: { onFechar: () => void; onSalvo: () => void }) {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [perfil, setPerfil] = useState<'tecnico' | 'gestor'>('tecnico')
  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    if (!email.trim() || senha.length < 8) {
      toast.error('Informe o e-mail e uma senha de pelo menos 8 caracteres')
      return
    }
    setSalvando(true)
    try {
      await criarUsuario({ nome: nome.trim(), email: email.trim(), password: senha, perfil })
      toast.success('Acesso criado', {
        description: 'Passe o e-mail e a senha para a pessoa entrar.',
      })
      onSalvo()
    } catch (e) {
      if (eSessaoExpirada(e)) return
      toast.error('Não foi possível criar', { description: getErrorMessage(e) })
    }
    setSalvando(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40 sm:items-center sm:justify-center">
      <div className="w-full rounded-t-2xl bg-background p-4 shadow-lg sm:max-w-md sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Nova pessoa</h2>
          <Button variant="ghost" size="icon" onClick={onFechar} aria-label="Fechar">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: João" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">E-mail</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="joao@axiomtec.com.br"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Senha inicial</Label>
            <Input
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Pelo menos 8 caracteres"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Perfil</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={perfil === 'tecnico' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPerfil('tecnico')}
              >
                Técnico
              </Button>
              <Button
                type="button"
                variant={perfil === 'gestor' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPerfil('gestor')}
              >
                Gestor
              </Button>
            </div>
          </div>
          <Button className="w-full gap-2" onClick={salvar} disabled={salvando}>
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Criar acesso
          </Button>
        </div>
      </div>
    </div>
  )
}
