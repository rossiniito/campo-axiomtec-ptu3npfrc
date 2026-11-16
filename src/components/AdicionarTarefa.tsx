import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus } from 'lucide-react'

/**
 * Controle "+ Adicionar tarefa" do fim de cada seção do checklist.
 * Fechado mostra o botão; aberto mostra o campo inline para digitar o
 * nome da tarefa e salvá-la naquela seção daquela OS/obra.
 */
export default function AdicionarTarefa({
  onSalvar,
  onCancelar,
}: {
  onSalvar: (nome: string) => void
  onCancelar: () => void
}) {
  const [aberto, setAberto] = useState(false)
  const [nome, setNome] = useState('')

  function salvar() {
    if (nome.trim()) onSalvar(nome)
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg border border-dashed py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
      >
        <Plus className="h-4 w-4" />
        Adicionar tarefa
      </button>
    )
  }

  return (
    <div className="mt-2 rounded-lg border bg-card p-3">
      <Input
        autoFocus
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        placeholder="Nome da tarefa (ex.: Trocar lâmpada do nicho)"
        aria-label="Nome da tarefa"
        className="text-sm"
        onKeyDown={(e) => {
          if (e.key === 'Enter') salvar()
          if (e.key === 'Escape') onCancelar()
        }}
      />
      <div className="mt-2 flex justify-end gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setNome('')
            setAberto(false)
            onCancelar()
          }}
        >
          Cancelar
        </Button>
        <Button size="sm" onClick={salvar} disabled={!nome.trim()}>
          Salvar tarefa
        </Button>
      </div>
    </div>
  )
}
