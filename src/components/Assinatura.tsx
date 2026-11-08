import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Eraser } from 'lucide-react'

type Props = {
  onChange: (dataUrl: string | null) => void
  altura?: number
  rotulo?: string
}

/** Área de assinatura a dedo no celular. Exporta PNG com fundo transparente. */
export default function Assinatura({ onChange, altura = 160, rotulo }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const desenhando = useRef(false)
  const temTraco = useRef(false)
  const [vazio, setVazio] = useState(true)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // escala para a densidade da tela, senão o traço sai serrilhado
    const dpr = window.devicePixelRatio || 1
    const largura = canvas.clientWidth
    canvas.width = largura * dpr
    canvas.height = altura * dpr

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)
    ctx.lineWidth = 2.2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#101418'
  }, [altura])

  function posicao(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function iniciar(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    canvas.setPointerCapture(e.pointerId)
    desenhando.current = true
    const { x, y } = posicao(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  function mover(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!desenhando.current) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const { x, y } = posicao(e)
    ctx.lineTo(x, y)
    ctx.stroke()
    temTraco.current = true
    if (vazio) setVazio(false)
  }

  function finalizar() {
    if (!desenhando.current) return
    desenhando.current = false
    const canvas = canvasRef.current
    if (canvas && temTraco.current) {
      onChange(canvas.toDataURL('image/png'))
    }
  }

  function limpar() {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    temTraco.current = false
    setVazio(true)
    onChange(null)
  }

  return (
    <div className="space-y-2">
      {rotulo && <p className="text-sm font-medium">{rotulo}</p>}
      <div className="relative overflow-hidden rounded-lg border bg-white">
        <canvas
          ref={canvasRef}
          className="w-full touch-none"
          style={{ height: altura }}
          onPointerDown={iniciar}
          onPointerMove={mover}
          onPointerUp={finalizar}
          onPointerLeave={finalizar}
          onPointerCancel={finalizar}
        />
        {vazio && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
            Assine aqui com o dedo
          </span>
        )}
        {!vazio && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1 h-7 gap-1 text-xs"
            onClick={limpar}
          >
            <Eraser className="h-3 w-3" /> Limpar
          </Button>
        )}
      </div>
    </div>
  )
}
