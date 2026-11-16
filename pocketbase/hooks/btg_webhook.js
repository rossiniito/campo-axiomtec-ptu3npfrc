/* Webhook do BTG Empresas: recebe crédito, débito e saldo.

   POST /backend/v1/btg/webhook
   Header: x-btg-secret: <segredo combinado>

   O BTG manda o corpo com o evento em `data` (ver ficha técnica:
   transactions.credit / transactions.debit / balance.avaliable), e manda
   `relatedParty.taxId` — o CNPJ/CPF da contraparte. É esse campo que faz a
   classificação ser confiável.

   REGRA DE OURO desta rota: NUNCA classificar por nome. A razão social da
   AxiomTec é o nome do sócio, então nome não distingue PJ de PF. Só documento.
   Se o documento não bater com o CNPJ da empresa nem com o CPF do sócio, o
   movimento fica "nao_classificado" — e isso é o comportamento correto. */
routerAdd('POST', '/backend/v1/btg/webhook', (e) => {
  const segredo = $secrets.get('BTG_WEBHOOK_SECRET')
  if (!segredo) {
    return e.json(500, { error: 'Webhook não configurado: falta BTG_WEBHOOK_SECRET' })
  }

  const recebido = e.request.header.get('x-btg-secret') || ''
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
  // O BTG manda o evento dentro de `data`; aceito corpo plano também,
  // para o teste manual e para eventual mudança de envelope.
  const d = body.data || body

  const tipoBruto = String(d.creditDebitIndicator || d.tipo || '').toUpperCase()
  if (!tipoBruto) {
    // evento de saldo não gera movimento: só confirma recebimento
    return e.json(200, { ok: true, ignorado: 'sem creditDebitIndicator' })
  }
  const tipo = tipoBruto === 'CREDIT' || tipoBruto === 'CREDITO' ? 'credito' : 'debito'

  const valor = parseFloat(String(d.amount !== undefined ? d.amount : d.valor || 0))
  if (isNaN(valor) || valor <= 0) return e.badRequestError('amount inválido')

  // chave de idempotência: o BTG reenvia em caso de erro (5, 10, 30, 60 min)
  const transactionId = String(d.transactionId || '')
  const chave =
    transactionId ||
    (d.payload && d.payload.endToEndId) ||
    String(d.date || '') + '|' + String(d.amount || '') + '|' + String(d.description || '')

  if (!chave) return e.badRequestError('não foi possível identificar a transação')

  let jaExiste = []
  try {
    jaExiste = $app.findRecordsByFilter('movimentos', 'chave = {:c}', '', 1, 0, { c: chave })
  } catch (_) {
    jaExiste = []
  }
  if (jaExiste.length > 0) {
    // Reenvio do banco: confirma sem duplicar.
    return e.json(200, { ok: true, duplicado: true, chave: chave })
  }

  const contraparte = d.relatedParty || {}
  const doc = String(contraparte.taxId || '').replace(/\D/g, '')
  const nomeContraparte = String(contraparte.name || '')

  // ---- classificação por documento ----
  let cnpjEmpresa = ''
  let cpfSocio = ''
  try {
    const cfgs = $app.findRecordsByFilter('config_financeiro', 'chave = "principal"', '', 1, 0)
    if (cfgs.length > 0) {
      cnpjEmpresa = String(cfgs[0].getString('cnpj_empresa') || '').replace(/\D/g, '')
      cpfSocio = String(cfgs[0].getString('cpf_socio') || '').replace(/\D/g, '')
    }
  } catch (_) {
    /* sem config: tudo fica nao_classificado, que é o correto */
  }

  let classificacao = 'nao_classificado'
  let classificadoPor = 'sem_documento'

  if (!doc) {
    classificacao = 'nao_classificado'
    classificadoPor = 'contraparte_sem_documento'
  } else if (cnpjEmpresa && doc === cnpjEmpresa) {
    // Mesmo CNPJ: ou é transferência entre contas da própria empresa, ou é
    // retirada/entrada do sócio (que tem CPF, não CNPJ). Sem o CPF separado,
    // a leitura segura é transferência interna.
    classificacao = 'transferencia_pj_pj'
    classificadoPor = 'cnpj_igual_empresa'
  } else if (cpfSocio && doc === cpfSocio) {
    classificacao = tipo === 'credito' ? 'aporte_socio' : 'retirada_socio'
    classificadoPor = 'cpf_igual_socio'
  } else if (tipo === 'credito') {
    classificacao = 'entrada_cliente'
    classificadoPor = 'documento_terceiro'
  } else {
    classificacao = 'saida_fornecedor'
    classificadoPor = 'documento_terceiro'
  }

  // ---- grava ----
  const mov = new Record($app.findCollectionByNameOrId('movimentos'))
  mov.set('chave', chave)
  mov.set('data', String(d.date || new Date().toISOString()))
  mov.set('tipo', tipo)
  mov.set('valor', valor)
  mov.set('moeda', String(d.currency || 'BRL'))
  mov.set('meio', String(d.type || ''))
  mov.set('descricao', String(d.description || ''))

  if (nomeContraparte) mov.set('contraparte_nome', nomeContraparte)
  if (doc) mov.set('contraparte_doc', doc)
  if (d.payload) {
    if (d.payload.endToEndId) mov.set('end_to_end_id', String(d.payload.endToEndId))
    if (d.payload.txId) mov.set('tx_id', String(d.payload.txId))
    if (d.payload.barcode) mov.set('codigo_barras', String(d.payload.barcode))
  }
  if (d.accountId) mov.set('conta_bancaria', String(d.accountId))

  mov.set('classificacao', classificacao)
  mov.set('classificado_por', classificadoPor)
  mov.set('conciliado', false)
  mov.set('origem', 'btg_webhook')
  mov.set('payload', JSON.stringify(body))

  $app.save(mov)

  $app
    .logger()
    .info(
      'movimento do BTG gravado',
      'tipo',
      tipo,
      'valor',
      valor,
      'classificacao',
      classificacao,
      'por',
      classificadoPor,
    )

  return e.json(201, {
    ok: true,
    chave: chave,
    tipo: tipo,
    classificacao: classificacao,
    classificado_por: classificadoPor,
  })
})
