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

    // --- 3. cronograma de recebimento: sinal + parcelas fixas ---
    // Padrão do Rossini (12/11/2026): 40% de sinal + 2 parcelas de 30%,
    // variável conforme negociação. Quem chama pode mandar os percentuais.
    const valor = orcamento.getFloat('valor') || 0
    let percentuais = [40, 30, 30]
    if (Array.isArray(body.parcelas) && body.parcelas.length > 0) {
      const enviados = []
      let soma = 0
      for (let i = 0; i < body.parcelas.length; i++) {
        const n = parseFloat(String(body.parcelas[i]))
        if (!isNaN(n) && n > 0) {
          enviados.push(n)
          soma += n
        }
      }
      if (enviados.length > 0 && Math.abs(soma - 100) < 0.01) percentuais = enviados
    }

    const gerados = []
    // só gera se ainda não existir parcela para esta obra+orçamento
    const jaTem = $app.findRecordsByFilter('recebimentos', 'orcamento = {:o}', '', 1, 0, {
      o: orcamento.id,
    })

    if (jaTem.length === 0 && valor > 0) {
      const base = body.data_sinal ? new Date(String(body.data_sinal)) : new Date()
      let acumulado = 0
      for (let i = 0; i < percentuais.length; i++) {
        const pct = percentuais[i]
        const d = new Date(base.getTime())
        d.setMonth(d.getMonth() + i)

        const v =
          i === percentuais.length - 1
            ? Math.round((valor - acumulado) * 100) / 100
            : Math.round(valor * (pct / 100) * 100) / 100
        acumulado += v

        const r = new Record($app.findCollectionByNameOrId('recebimentos'))
        r.set('obra', obra.id)
        r.set('orcamento', orcamento.id)
        r.set('tipo', i === 0 ? 'sinal' : 'parcela')
        r.set(
          'descricao',
          i === 0
            ? 'Sinal (' + pct + '%)'
            : 'Parcela ' + i + ' de ' + (percentuais.length - 1) + ' (' + pct + '%)',
        )
        r.set('percentual', pct)
        r.set('valor', v)
        r.set('vencimento', d.toISOString())
        r.set('status', 'a_receber')
        $app.save(r)
        gerados.push({ tipo: i === 0 ? 'sinal' : 'parcela', percentual: pct, valor: v })
      }
    }

    return e.json(200, {
      orcamento: String(orcamento.get('cliente')),
      obra: String(obra.get('nome')),
      os: String(ordem.get('numero')),
      os_id: String(ordem.id),
      recebimentos: gerados,
    })
  },
  $apis.requireAuth(),
)
