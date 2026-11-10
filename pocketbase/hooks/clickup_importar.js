/* Importa o checklist de uma obra direto do ClickUp.
   Lê a estrutura real usada hoje: tarefa da obra -> checklists = ambientes
   -> itens = itens do checklist. Idempotente: casa por ambiente + nome. */
routerAdd(
  'POST',
  '/backend/v1/clickup/importar',
  (e) => {
    const body = e.requestInfo().body || {}
    const token = String(body.token || $secrets.get('CLICKUP_TOKEN') || '').trim()
    const taskId = String(body.task_id || '').trim()
    const obraId = String(body.obra_id || '').trim()
    const somentePendentes = body.somente_pendentes === true

    if (!token) {
      return e.json(400, {
        error: 'Informe o token do ClickUp ou configure o secret CLICKUP_TOKEN.',
      })
    }
    if (!taskId) return e.json(400, { error: 'Informe o id da tarefa do ClickUp (task_id).' })
    if (!obraId) return e.json(400, { error: 'Informe a obra destino (obra_id).' })

    let obra
    try {
      obra = $app.findRecordById('obras', obraId)
    } catch (_) {
      return e.json(404, { error: 'Obra não encontrada: ' + obraId })
    }

    const res = $http.send({
      url: 'https://api.clickup.com/api/v2/task/' + taskId,
      method: 'GET',
      headers: { Authorization: token, 'Content-Type': 'application/json' },
      timeout: 25,
    })

    if (res.statusCode !== 200) {
      return e.json(502, {
        error: 'O ClickUp respondeu ' + res.statusCode + '. Verifique o token e o id da tarefa.',
      })
    }

    const tarefa = res.json || {}
    const checklists = tarefa.checklists || []
    if (checklists.length === 0) {
      return e.json(422, {
        error: 'A tarefa "' + (tarefa.name || taskId) + '" não tem checklist no ClickUp.',
      })
    }

    const ambientesCriados = []
    let itensCriados = 0
    let itensIgnorados = 0

    for (let i = 0; i < checklists.length; i++) {
      const checklist = checklists[i]

      // um checklist do ClickUp vira um ambiente da obra
      const encontrados = $app.findRecordsByFilter(
        'ambientes',
        'obra = {:obra} && nome = {:nome}',
        '',
        1,
        0,
        { obra: obra.id, nome: checklist.name },
      )

      let ambiente
      if (encontrados.length > 0) {
        ambiente = encontrados[0]
      } else {
        ambiente = new Record($app.findCollectionByNameOrId('ambientes'))
        ambiente.set('obra', obra.id)
        ambiente.set('nome', checklist.name)
        ambiente.set('ordem', i)
        $app.save(ambiente)
        ambientesCriados.push(checklist.name)
      }

      const itensDoChecklist = (checklist.items || []).slice()
      itensDoChecklist.sort(function (a, b) {
        return (a.orderindex || 0) - (b.orderindex || 0)
      })

      for (let j = 0; j < itensDoChecklist.length; j++) {
        const item = itensDoChecklist[j]

        if (somentePendentes && item.resolved) {
          itensIgnorados++
          continue
        }

        // a chave é ambiente + nome: "Spot Mini" existe em dois ambientes
        const existentes = $app.findRecordsByFilter(
          'itens',
          'ambiente = {:ambiente} && nome = {:nome}',
          '',
          1,
          0,
          { ambiente: ambiente.id, nome: item.name },
        )
        if (existentes.length > 0) {
          itensIgnorados++
          continue
        }

        const registro = new Record($app.findCollectionByNameOrId('itens'))
        registro.set('obra', obra.id)
        registro.set('ambiente', ambiente.id)
        registro.set('nome', item.name)
        registro.set('concluido', item.resolved === true)
        registro.set('ordem', j)
        if (item.resolved === true) {
          registro.set('concluido_em', new Date().toISOString())
        }
        $app.save(registro)
        itensCriados++
      }
    }

    return e.json(200, {
      tarefa: tarefa.name || taskId,
      ambientes_criados: ambientesCriados,
      itens_criados: itensCriados,
      itens_ignorados: itensIgnorados,
    })
  },
  $apis.requireSuperuserAuth(),
)
