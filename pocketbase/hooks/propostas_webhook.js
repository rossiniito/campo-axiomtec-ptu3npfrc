/* Webhook: o sistema de propostas avisa este app quando algo acontece.

   POST /backend/v1/propostas/webhook
   Header: x-propostas-secret: <segredo combinado>

   Aceita qualquer um destes eventos (o sistema de origem decide o nome):
     proposta.enviada | proposta.aberta | proposta.aceita | proposta.recusada

   Regras de segurança, em ordem:
   1. Segredo obrigatório no header. Sem segredo configurado, a rota fecha (500)
      em vez de aceitar qualquer um — falha segura.
   2. Comparação em tempo constante, para não vazar o segredo por timing.
   3. Upsert por proposta_id: o mesmo evento chegando duas vezes não duplica.
   4. Não confia no status para "regredir": se já foi aceita, uma abertura
      posterior não volta para "visualizada". */
routerAdd('POST', '/backend/v1/propostas/webhook', (e) => {
  const segredo = $secrets.get('PROPOSTAS_WEBHOOK_SECRET')
  if (!segredo) {
    return e.json(500, { error: 'Webhook não configurado: falta PROPOSTAS_WEBHOOK_SECRET' })
  }

  const recebido = e.request.header.get('x-propostas-secret') || ''
  // comparação em tempo constante
  let igual = recebido.length === segredo.length
  if (igual) {
    let dif = 0
    for (let i = 0; i < segredo.length; i++) {
      dif |= recebido.charCodeAt(i) ^ segredo.charCodeAt(i)
    }
    igual = dif === 0
  }
  if (!igual) return e.unauthorizedError('Segredo inválido')

  const body = e.requestInfo().body || {}
  const propostaId = String(body.proposta_id || body.id || '').trim()
  if (!propostaId) return e.badRequestError('proposta_id é obrigatório')

  const evento = String(body.evento || body.event || '')
    .trim()
    .toLowerCase()
  const agora = new Date().toISOString()

  // status que o evento representa
  let status = String(body.status || '')
    .trim()
    .toLowerCase()
  if (!status) {
    if (evento === 'proposta.enviada') status = 'enviada'
    else if (evento === 'proposta.aberta' || evento === 'proposta.visualizada')
      status = 'visualizada'
    else if (evento === 'proposta.aceita') status = 'aceita'
    else if (evento === 'proposta.recusada') status = 'recusada'
  }
  const validos = ['rascunho', 'enviada', 'visualizada', 'aceita', 'recusada', 'expirada']
  if (status && validos.indexOf(status) === -1) status = ''

  // não regride status: aceita é final
  const ordem = { rascunho: 0, enviada: 1, visualizada: 2, recusada: 3, expirada: 3, aceita: 4 }

  let registro = null
  try {
    registro = $app.findFirstRecordByFilter('propostas', 'proposta_id = {:id}', { id: propostaId })
  } catch (_) {
    registro = null
  }

  if (!registro) {
    registro = new Record($app.findCollectionByNameOrId('propostas'))
    registro.set('proposta_id', propostaId)
    registro.set('visitas', 0)
  }

  const statusAtual = String(registro.getString('status') || '')
  if (!status) {
    // evento sem status conhecido: só atualiza atividade
    if (evento === 'proposta.aberta' || evento === 'proposta.visualizada') {
      registro.set('ultima_atividade', agora)
      if (!registro.getString('primeira_abertura')) registro.set('primeira_abertura', agora)
      registro.set('visitas', (registro.getInt('visitas') || 0) + 1)
    }
  } else if (!statusAtual || ordem[status] >= (ordem[statusAtual] || 0)) {
    registro.set('status', status)
    if (status === 'aceita') registro.set('aceita_em', agora)
    if (status === 'enviada' && !registro.getString('enviada_em')) registro.set('enviada_em', agora)
  }

  if (body.projeto) registro.set('projeto', String(body.projeto))
  if (body.cliente) registro.set('cliente', String(body.cliente))
  if (body.vendedor) registro.set('vendedor', String(body.vendedor))
  if (body.link_token) registro.set('link_token', String(body.link_token))
  if (typeof body.valor === 'number') registro.set('valor', body.valor)
  else if (body.valor) {
    const v = parseFloat(String(body.valor).replace(/[^\d.-]/g, ''))
    if (!isNaN(v)) registro.set('valor', v)
  }

  if (evento === 'proposta.aberta' || evento === 'proposta.visualizada') {
    registro.set('ultima_atividade', agora)
    if (!registro.getString('primeira_abertura')) registro.set('primeira_abertura', agora)
    if (body.visitas === undefined) {
      registro.set('visitas', (registro.getInt('visitas') || 0) + 1)
    }
  }
  if (body.visitas !== undefined) {
    const n = parseInt(String(body.visitas), 10)
    if (!isNaN(n)) registro.set('visitas', n)
  }
  if (body.ultima_atividade) registro.set('ultima_atividade', String(body.ultima_atividade))

  $app.save(registro)

  $app
    .logger()
    .info(
      'proposta recebida por webhook',
      'proposta_id',
      propostaId,
      'evento',
      evento,
      'status',
      status,
    )

  return e.json(200, { ok: true, proposta_id: propostaId, status: registro.getString('status') })
})
