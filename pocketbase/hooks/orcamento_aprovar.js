/* Aprovou o orçamento, nasce a obra e a primeira OS.

   É o equivalente da automação do ClickUp (orçamento aprovado -> tarefa em
   Instalação), mas dentro do mesmo sistema: sem integração, sem webhook,
   sem cópia. A OS nasce vazia, para o técnico aplicar o modelo de checklist
   do tipo de serviço — o que já funciona hoje. */
routerAdd(
  'POST',
  '/backend/v1/orcamento/aprovar',
  (e) => {
    const body = e.requestInfo().body || {}
    const orcamentoId = String(body.orcamento_id || '').trim()

    if (!orcamentoId) return e.json(400, { error: 'Informe o orçamento (orcamento_id).' })

    let orcamento
    try {
      orcamento = $app.findRecordById('orcamentos', orcamentoId)
    } catch (_) {
      return e.json(404, { error: 'Orçamento não encontrado.' })
    }

    if (String(orcamento.get('status')) === 'aprovado') {
      return e.json(409, { error: 'Este orçamento já está aprovado.' })
    }

    // --- 1. obra (casa por cliente: reativa a obra existente se houver) ---
    const cliente = String(orcamento.get('cliente') || '').trim()
    let obra = null
    const porCliente = $app.findRecordsByFilter('obras', 'nome = {:nome}', '', 1, 0, {
      nome: cliente,
    })
    if (porCliente.length > 0) {
      obra = porCliente[0]
    } else {
      obra = new Record($app.findCollectionByNameOrId('obras'))
      obra.set('nome', cliente)
      obra.set('cliente', cliente)
      obra.set('status', 'executando')
      $app.save(obra)
    }

    // --- 2. primeira OS com numeração sequencial ---
    let proximo = 1
    const ultimas = $app.findRecordsByFilter('ordens', '', '-numero', 1, 0)
    if (ultimas.length > 0) {
      const n = String(ultimas[0].get('numero') || '')
      const m = n.match(/(\d+)\s*$/)
      if (m) proximo = parseInt(m[1], 10) + 1
    }

    const jaTemOS = $app.findRecordsByFilter('ordens', 'obra = {:obra}', '', 1, 0, {
      obra: obra.id,
    })

    let ordem
    if (jaTemOS.length > 0) {
      ordem = jaTemOS[0]
    } else {
      ordem = new Record($app.findCollectionByNameOrId('ordens'))
      ordem.set('obra', obra.id)
      ordem.set('numero', 'OS-' + String(proximo).padStart(3, '0'))
      ordem.set('status', 'aberta')
      ordem.set('descricao', String(orcamento.get('escopo') || 'Instalação'))
      $app.save(ordem)
    }

    orcamento.set('status', 'aprovado')
    orcamento.set('data_aprovacao', new Date().toISOString())
    orcamento.set('obra', obra.id)
    $app.save(orcamento)

    return e.json(200, {
      orcamento: String(orcamento.get('cliente')),
      obra: String(obra.get('nome')),
      os: String(ordem.get('numero')),
      os_id: String(ordem.id),
    })
  },
  $apis.requireAuth(),
)
