/* Geração do relatório de entrega em PDF, com timbre AxiomTec.
   Usa jsPDF no navegador: sem servidor, o próprio celular do técnico gera o arquivo. */
import { jsPDF } from 'jspdf'
import pb from '@/lib/pocketbase/client'
import { fotosDoItem, type Ambiente, type Item, type Obra } from '@/lib/offline'

const AZUL: [number, number, number] = [31, 58, 95]
const CINZA: [number, number, number] = [90, 100, 114]
const VERDE: [number, number, number] = [46, 125, 91]
const LARANJA: [number, number, number] = [180, 101, 26]
const LINHA: [number, number, number] = [214, 220, 228]
const FUNDO: [number, number, number] = [244, 246, 249]
const TXT: [number, number, number] = [32, 38, 46]

export type Assinaturas = {
  cliente?: string | null
  tecnico?: string | null
  nomeResponsavel?: string
  observacoes?: string
  dataAssinatura?: string
}

type Contexto = {
  obra: Obra
  ambientes: Ambiente[]
  itens: Item[]
  assinaturas?: Assinaturas
}

const L = 18
const R = 192
const LARG = R - L
const TITULO = 'Relatório de Implantação'

function dataBR(iso?: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function horaBR(iso?: string) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function carregarImagem(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

/** Cabeçalho e rodapé de todas as páginas; chamada no fim, quando o total é conhecido. */
function aplicarMolduras(doc: jsPDF) {
  const total = doc.getNumberOfPages()
  for (let p = 1; p <= total; p++) {
    doc.setPage(p)
    doc.setFillColor(...AZUL)
    doc.rect(0, 0, 210, 12, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text('AXIOMTEC  ·  AUTOMAÇÃO RESIDENCIAL', L, 7.8)
    doc.setFont('helvetica', 'normal')
    doc.text(TITULO, R, 7.8, { align: 'right' })

    doc.setDrawColor(...LINHA)
    doc.setLineWidth(0.3)
    doc.line(L, 282, R, 282)
    doc.setTextColor(...CINZA)
    doc.setFontSize(7)
    doc.text('Documento gerado pelo sistema de campo AxiomTec', L, 287)
    doc.text(`Página ${p} de ${total}`, R, 287, { align: 'right' })
    doc.setTextColor(...TXT)
  }
}

function tituloSecao(doc: jsPDF, texto: string, y: number) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...AZUL)
  doc.text(texto, L, y)
  doc.setTextColor(...TXT)
  return y + 5
}

export async function gerarRelatorioPDF(ctx: Contexto): Promise<{ blob: Blob; nome: string }> {
  const { obra, ambientes, itens, assinaturas } = ctx

  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  const totalItens = itens.length
  const concluidos = itens.filter((i) => i.concluido).length
  const percentual = totalItens > 0 ? Math.round((concluidos / totalItens) * 100) : 0
  const agora = assinaturas?.dataAssinatura ?? new Date().toISOString()

  // ===== CAPA / RESUMO =====
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(...AZUL)
  doc.text(TITULO, L, 30)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...CINZA)
  doc.text(
    `Obra ${obra.nome}${obra.arquiteta ? `  ·  Arquitetura: ${obra.arquiteta}` : ''}  ·  Emitido em ${dataBR(agora)}`,
    L,
    37,
  )
  doc.setTextColor(...TXT)

  const linhasResumo: [string, string][] = [
    ['Cliente', obra.cliente || obra.nome],
    ['Endereço', obra.endereco || '—'],
    ['Progresso', `${concluidos} de ${totalItens} itens concluídos  (${percentual}%)`],
    ['Situação', 'Instalação em execução'],
  ]
  if (assinaturas?.nomeResponsavel)
    linhasResumo.push(['Responsável no local', assinaturas.nomeResponsavel])

  const alturaResumo = 6 + linhasResumo.length * 6
  doc.setFillColor(...FUNDO)
  doc.setDrawColor(...LINHA)
  doc.setLineWidth(0.3)
  doc.roundedRect(L, 44, LARG, alturaResumo, 1.5, 1.5, 'FD')

  let y = 49
  linhasResumo.forEach(([k, v]) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.text(k, L + 4, y)
    doc.setFont('helvetica', 'normal')
    doc.text(v, L + 42, y)
    y += 6
  })

  // tabela por ambiente
  y = 44 + alturaResumo + 12
  y = tituloSecao(doc, 'Situação por ambiente', y)

  const colX = [L, L + 55, L + 82, L + 105, L + 128]
  doc.setFillColor(...AZUL)
  doc.rect(L, y, LARG, 7, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  ;['Ambiente', 'Concluídos', 'Pendentes', 'Total', 'Situação'].forEach((h, i) => {
    doc.text(h, colX[i] + 2, y + 4.8)
  })
  doc.setTextColor(...TXT)
  y += 7

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  ambientes.forEach((amb, idx) => {
    const doAmb = itens.filter((i) => i.ambiente === amb.id)
    const ok = doAmb.filter((i) => i.concluido).length
    const pend = doAmb.length - ok
    if (idx % 2 === 1) {
      doc.setFillColor(...FUNDO)
      doc.rect(L, y, LARG, 7, 'F')
    }
    doc.setDrawColor(...LINHA)
    doc.setLineWidth(0.2)
    doc.line(L, y + 7, R, y + 7)
    doc.text(amb.nome, colX[0] + 2, y + 4.8)
    doc.text(String(ok), colX[1] + 2, y + 4.8)
    doc.text(String(pend), colX[2] + 2, y + 4.8)
    doc.text(String(doAmb.length), colX[3] + 2, y + 4.8)
    doc.text(pend === 0 ? 'Concluído' : `${ok} de ${doAmb.length}`, colX[4] + 2, y + 4.8)
    y += 7
  })

  // ===== CHECKLIST DETALHADO =====
  doc.addPage()
  y = 24
  y = tituloSecao(doc, 'Checklist detalhado', y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...CINZA)
  doc.text('Itens conferidos em campo, com observações registradas pelo técnico.', L, y)
  doc.setTextColor(...TXT)
  y += 8

  for (const amb of ambientes) {
    const doAmb = itens
      .filter((i) => i.ambiente === amb.id)
      .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
    if (doAmb.length === 0) continue

    if (y > 258) {
      doc.addPage()
      y = 24
    }

    const ok = doAmb.filter((i) => i.concluido).length
    doc.setFillColor(...FUNDO)
    doc.rect(L, y, LARG, 7, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...AZUL)
    doc.text(amb.nome, L + 2, y + 4.8)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...CINZA)
    doc.text(`${ok} de ${doAmb.length}`, R - 2, y + 4.8, { align: 'right' })
    doc.setTextColor(...TXT)
    y += 9

    for (const item of doAmb) {
      const obs = (item.observacao || '').trim()
      const linhasObs = obs ? doc.splitTextToSize(obs, LARG - 14) : []
      const altura = 6 + linhasObs.length * 3.6

      if (y + altura > 270) {
        doc.addPage()
        y = 24
      }

      doc.setDrawColor(...(item.concluido ? VERDE : LARANJA))
      doc.setLineWidth(0.6)
      if (item.concluido) {
        doc.setFillColor(...VERDE)
        doc.rect(L + 1, y, 3, 3, 'F')
      } else {
        doc.rect(L + 1, y, 3, 3)
      }

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(...TXT)
      doc.text(item.nome, L + 7, y + 2.6)

      const qtdFotos = fotosDoItem(item).length
      if (qtdFotos > 0) {
        doc.setTextColor(...CINZA)
        doc.setFontSize(7)
        doc.text(`${qtdFotos} foto${qtdFotos > 1 ? 's' : ''}`, R - 2, y + 2.6, { align: 'right' })
        doc.setTextColor(...TXT)
        doc.setFontSize(8.5)
      }

      if (linhasObs.length > 0) {
        doc.setTextColor(...CINZA)
        doc.setFontSize(7.5)
        linhasObs.forEach((linha, i) => {
          doc.text(linha, L + 7, y + 6.2 + i * 3.6)
        })
        doc.setTextColor(...TXT)
        doc.setFontSize(8.5)
      }
      y += altura
    }
    y += 3
  }

  // ===== REGISTRO FOTOGRÁFICO =====
  const comFoto = itens.filter((i) => fotosDoItem(i).length > 0)

  if (comFoto.length > 0) {
    doc.addPage()
    y = 24
    y = tituloSecao(doc, 'Registro fotográfico', y)

    const LARG_FOTO = 54
    const ALT_FOTO = 54
    let col = 0
    let linhaY = y

    for (const item of comFoto) {
      for (const nomeArquivo of fotosDoItem(item)) {
        let url = ''
        try {
          url = pb.files.getURL(item as never, nomeArquivo, { thumb: '600x600' })
        } catch {
          continue
        }

        if (col === 3) {
          col = 0
          linhaY += ALT_FOTO + 16
        }
        if (linhaY + ALT_FOTO + 10 > 274) {
          doc.addPage()
          linhaY = 24
          col = 0
        }

        const x = L + col * (LARG_FOTO + 8)
        try {
          const img = await carregarImagem(url)
          const proporcao = img.height / img.width
          let w = LARG_FOTO
          let h = w * proporcao
          if (h > ALT_FOTO) {
            h = ALT_FOTO
            w = h / proporcao
          }
          doc.addImage(img, 'JPEG', x + (LARG_FOTO - w) / 2, linhaY + (ALT_FOTO - h) / 2, w, h)
        } catch {
          doc.setDrawColor(...LINHA)
          doc.setLineWidth(0.2)
          doc.rect(x, linhaY, LARG_FOTO, ALT_FOTO)
          doc.setFontSize(7)
          doc.setTextColor(...CINZA)
          doc.text('foto indisponível', x + LARG_FOTO / 2, linhaY + ALT_FOTO / 2, {
            align: 'center',
          })
          doc.setTextColor(...TXT)
        }

        doc.setFontSize(6.5)
        doc.setTextColor(...CINZA)
        const legenda = doc.splitTextToSize(item.nome, LARG_FOTO)
        doc.text(legenda.slice(0, 2), x, linhaY + ALT_FOTO + 3.5)
        doc.setTextColor(...TXT)
        col += 1
      }
    }
  }

  // ===== CONSIDERAÇÕES E ACEITE =====
  const temAssinatura = Boolean(assinaturas?.cliente || assinaturas?.tecnico)
  if (temAssinatura || assinaturas?.observacoes) {
    doc.addPage()
    y = 24
    y = tituloSecao(doc, 'Considerações e aceite', y)

    if (assinaturas?.observacoes) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      const linhas = doc.splitTextToSize(assinaturas.observacoes, LARG)
      doc.text(linhas, L, y)
      y += linhas.length * 4.5 + 6
    }

    const larguraAss = 74
    const alturaAss = 26
    const yAss = Math.max(y + 10, 190)

    const blocos = [
      {
        rotulo: 'Assinatura do cliente',
        src: assinaturas?.cliente,
        nome: assinaturas?.nomeResponsavel,
      },
      { rotulo: 'Assinatura do técnico', src: assinaturas?.tecnico, nome: 'AxiomTec' },
    ]

    for (let i = 0; i < blocos.length; i++) {
      const dados = blocos[i]
      const x = L + i * (larguraAss + 12)
      doc.setDrawColor(...LINHA)
      doc.setLineWidth(0.3)
      doc.line(x, yAss + alturaAss, x + larguraAss, yAss + alturaAss)

      if (dados.src) {
        try {
          const img = await carregarImagem(dados.src)
          const prop = img.height / img.width
          let w = larguraAss
          let h = w * prop
          if (h > alturaAss) {
            h = alturaAss
            w = h / prop
          }
          doc.addImage(img, 'PNG', x + (larguraAss - w) / 2, yAss + (alturaAss - h), w, h)
        } catch {
          /* segue sem a imagem */
        }
      }

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(...AZUL)
      doc.text(dados.rotulo, x, yAss + alturaAss + 5)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...CINZA)
      if (dados.nome) doc.text(dados.nome, x, yAss + alturaAss + 10)
      doc.setTextColor(...TXT)
    }

    doc.setFontSize(8)
    doc.setTextColor(...CINZA)
    doc.text(
      `Assinado eletronicamente em ${dataBR(agora)}${horaBR(agora) ? ` às ${horaBR(agora)}` : ''}.`,
      L,
      yAss + alturaAss + 22,
    )
    doc.setTextColor(...TXT)
  }

  aplicarMolduras(doc)

  const nomeLimpo = obra.nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .toLowerCase()
  const nome = `relatorio-${nomeLimpo}-${dataBR(agora).replace(/\//g, '-')}.pdf`
  return { blob: doc.output('blob'), nome }
}

/** Dispara o download do PDF no aparelho. */
export function baixarPDF(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}
