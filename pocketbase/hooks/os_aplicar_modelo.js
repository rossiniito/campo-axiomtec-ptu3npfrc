/* Aplica um modelo de checklist numa OS.

   Faz duas coisas em sequência:
   1. cria os ambientes e itens da OS a partir do modelo (no app);
   2. cria o mesmo checklist na tarefa do ClickUp, pela API, e guarda os ids
      dos itens criados — é o que permite a sincronização noturna marcar o
      item certo em vez de tentar casar por nome.

   O passo 2 exige token. Sem token, a OS fica pronta no app e
   `checklist_criado_clickup_em` continua nulo, para tentar de novo depois. */
routerAdd('POST', '/backend/v1/os/aplicar-modelo', (e) => {
  const body = e.requestInfo().body || {}
  const ordemId = String(body.ordem_id || '').trim()
  const modeloId = String(body.modelo_id || '').trim()
  const aplicarClickup = body.aplicar_clickup !== false
  const token = String(body.token || $secrets.get('CLICKUP_TOKEN') || '').trim()

  if (!ordemId) return e.json(400, { error: 'Informe a OS (ordem_id).' })
  if (!modeloId) return e.json(400, { error: 'Informe o modelo (modelo_id).' })

  let ordem
  try {
    ordem = $app.findRecordById('ordens', ordemId)
  } catch (_) {
    return e.json(404, { error: 'OS não encontrada.' })
  }

  let modelo
  try {
    modelo = $app.findRecordById('modelos', modeloId)
  } catch (_) {
    return e.json(404, { error: 'Modelo não encontrado.' })
  }

  // não aplica duas vezes: o checklist dobraria
  const jaTem = $app.findRecordsByFilter('itens', 'ordem_servico = {:os}', '', 1, 0, {
    os: ordem.id,
  })
  if (jaTem.length > 0) {
    return e.json(409, {
      error: 'Esta OS já tem checklist. Aplicar o modelo de novo duplicaria os itens.',
    })
  }

  let estrutura = []
  try {
    estrutura = JSON.parse(String(modelo.get('estrutura') || '[]'))
  } catch (_) {
    return e.json(422, { error: 'O modelo está com a estrutura inválida.' })
  }
  if (!Array.isArray(estrutura) || estrutura.length === 0) {
    return e.json(422, { error: 'O modelo não tem ambientes.' })
  }

  const obraId = String(ordem.get('obra'))
  const taskId = String(ordem.get('clickup_task_id') || '')
  const porAmbiente = []

  // ---------- 1. cria no app ----------
  for (let a = 0; a < estrutura.length; a++) {
    const bloco = estrutura[a]
    const nomeAmbiente = String(bloco.ambiente || 'Geral')

    const achados = $app.findRecordsByFilter(
      'ambientes',
      'obra = {:obra} && nome = {:nome}',
      '',
      1,
      0,
      { obra: obraId, nome: nomeAmbiente },
    )
    let ambiente
    if (achados.length > 0) {
      ambiente = achados[0]
    } else {
      ambiente = new Record($app.findCollectionByNameOrId('ambientes'))
      ambiente.set('obra', obraId)
      ambiente.set('nome', nomeAmbiente)
      ambiente.set('ordem', a)
      $app.save(ambiente)
    }

    const itens = bloco.itens || []
    const criados = []
    for (let i = 0; i < itens.length; i++) {
      const registro = new Record($app.findCollectionByNameOrId('itens'))
      registro.set('obra', obraId)
      registro.set('ambiente', ambiente.id)
      registro.set('ordem_servico', ordem.id)
      registro.set('ordem', i)
      registro.set('nome', String(itens[i]))
      registro.set('concluido', false)
      $app.save(registro)
      criados.push(registro)
    }
    porAmbiente.push({ ambiente: ambiente, itens: criados, nome: nomeAmbiente })
  }

  ordem.set('modelo', modelo.id)
  $app.save(ordem)

  const totalItens = porAmbiente.reduce(function (soma, x) {
    return soma + x.itens.length
  }, 0)
  const resposta = {
    ambientes: porAmbiente.length,
    itens: totalItens,
    clickup: 'nao_solicitado',
    avisos: [],
  }

  // ---------- 2. cria o checklist no ClickUp ----------
  const jaCriado = String(ordem.get('checklist_criado_clickup_em') || '')
  if (!aplicarClickup || !taskId) {
    resposta.clickup = taskId ? 'nao_solicitado' : 'sem_tarefa_vinculada'
    return e.json(200, resposta)
  }
  if (jaCriado) {
    resposta.clickup = 'ja_existia'
    return e.json(200, resposta)
  }
  if (!token) {
    resposta.clickup = 'sem_token'
    resposta.avisos.push('Checklist criado no app, mas não no ClickUp: falta o token.')
    return e.json(200, resposta)
  }

  let falhas = 0
  for (let a = 0; a < porAmbiente.length; a++) {
    const bloco = porAmbiente[a]

    const resChecklist = $http.send({
      url: 'https://api.clickup.com/api/v2/task/' + taskId + '/checklist',
      method: 'POST',
      headers: { Authorization: token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: bloco.nome }),
      timeout: 25,
    })

    if (resChecklist.statusCode !== 200) {
      falhas++
      resposta.avisos.push('checklist "' + bloco.nome + '": HTTP ' + resChecklist.statusCode)
      continue
    }

    const checklistCriado = (resChecklist.json || {}).checklist || {}
    const checklistId = String(checklistCriado.id || '')

    for (let i = 0; i < bloco.itens.length; i++) {
      const registro = bloco.itens[i]

      const resItem = $http.send({
        url: 'https://api.clickup.com/api/v2/checklist/' + checklistId + '/checklist_item',
        method: 'POST',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: String(registro.get('nome')) }),
        timeout: 25,
      })

      if (resItem.statusCode !== 200) {
        falhas++
        continue
      }

      // guarda os ids para a sincronização noturna acertar o item exato
      const itemCriado = (resItem.json || {}).checklist || {}
      const itensDoClickup = itemCriado.items || []
      let novoId = ''
      for (let k = 0; k < itensDoClickup.length; k++) {
        if (String(itensDoClickup[k].name) === String(registro.get('nome'))) {
          novoId = String(itensDoClickup[k].id)
        }
      }
      if (novoId) {
        registro.set('clickup_item_id', novoId)
        registro.set('clickup_checklist_id', checklistId)
        $app.save(registro)
      }
    }
  }

  if (falhas === 0) {
    ordem.set('checklist_criado_clickup_em', new Date().toISOString())
    $app.save(ordem)
    resposta.clickup = 'criado'
  } else {
    ordem.set('ultimo_erro_sync', 'Checklist no ClickUp incompleto: ' + falhas + ' falha(s)')
    $app.save(ordem)
    resposta.clickup = 'parcial'
  }

  return e.json(200, resposta)
})
