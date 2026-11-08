/* Importa o checklist de uma obra direto do ClickUp.
   Lê a estrutura real usada hoje: tarefa da obra -> checklists = ambientes
   -> itens = itens do checklist. Idempotente: casa por ambiente + nome. */

type ClickUpItem = { name: string; resolved: boolean; orderindex: number }
type ClickUpChecklist = { name: string; items: ClickUpItem[] }

function tokensAleatorios(n: number) {
  let s = ''
  try {
    const arr = new Uint8Array(n)
    crypto.getRandomValues(arr)
    for (let i = 0; i < n; i++) s += 'abcdefghijklmnopqrstuvwxyz0123456789'[arr[i] % 36]
  } catch {
    for (let i = 0; i < n; i++) s += 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]
  }
  return s
}

routerAdd('POST', '/backend/v1/clickup/importar', (e) => {
  const body = e.requestInfo().body || {}
  const token = String(body.token || $secrets.get('CLICKUP_TOKEN') || '').trim()
  const taskId = String(body.task_id || '').trim()
  const obraId = String(body.obra_id || '').trim()
  const somentePendentes = body.somente_pendentes === true

  if (!token) return e.json(400, { error: 'Informe o token do ClickUp ou configure o secret CLICKUP_TOKEN.' })
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
  const checklists = (tarefa.checklists || []) as ClickUpChecklist[]
  if (checklists.length === 0) {
    return e.json(422, {
      error: 'A tarefa "' + (tarefa.name || taskId) + '" não tem checklist no ClickUp.',
    })
  }

  const ambientesCriados: string[] = []
  const itensCriados: string[] = []
  const itensIgnorados: string[] = []

  checklists.forEach((checklist, indiceAmbiente) => {
    // um checklist do ClickUp vira um ambiente da obra
    let ambiente
    const encontrados = $app.findRecordsByFilter(
      'ambientes',
      'obra = {:obra} && nome = {:nome}',
      '',
      1,
      0,
      { obra: obra.id, nome: checklist.name },
    )
    if (encontrados.length > 0) {
      ambiente = encontrados[0]
    } else {
      ambiente = new Record($app.findCollectionByNameOrId('ambientes'))
      ambiente.set('obra', obra.id)
      ambiente.set('nome', checklist.name)
      ambiente.set('ordem', indiceAmbiente)
      $app.save(ambiente)
      ambientesCriados.push(checklist.name)
    }

    const itens = (checklist.items || []).slice().sort(function (a, b) {
      return (a.orderindex || 0) - (b.orderindex || 0)
    })

    itens.forEach((item, indiceItem) => {
      if (somentePendentes && item.resolved) {
        itensIgnorados.push(item.name)
        return
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
        itensIgnorados.push(item.name)
        return
      }

      const registro = new Record($app.findCollectionByNameOrId('itens'))
      registro.set('obra', obra.id)
      registro.set('ambiente', ambiente.id)
      registro.set('nome', item.name)
      registro.set('concluido', Boolean(item.resolved))
      registro.set('ordem', indiceItem)
      if (item.resolved) {
        registro.set('concluido_em', new Date().toISOString())
      }
      $app.save(registro)
      itensCriados.push(item.name)
    })
  })

  return e.json(200, {
    tarefa: tarefa.name || taskId,
    ambientes_criados: ambientesCriados,
    itens_criados: itensCriados.length,
    itens_ignorados: itensIgnorados.length,
    detalhe: {
      ambientes: ambientesCriados,
      criados: itensCriados,
    },
  })
})
