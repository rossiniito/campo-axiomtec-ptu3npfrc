/* Gera OS a partir das tarefas da lista Instalação do ClickUp.

   O backend do Skip é interno, então o ClickUp NÃO consegue chamar um webhook
   aqui. Por isso a direção é inversa: este hook consulta o ClickUp (pela API)
   e cria a OS de cada tarefa nova. Pode ser chamado pelo botão "Buscar OS".

   Idempotente: a chave é o id da tarefa no ClickUp, não o nome — existem duas
   tarefas chamadas "Marina" e duas "Módulos Dimmer -1" na mesma lista. */
routerAdd('POST', '/backend/v1/os/puxar', (e) => {
  const body = e.requestInfo().body || {}
  const token = String(body.token || $secrets.get('CLICKUP_TOKEN') || '').trim()
  const listaId = String(body.list_id || $secrets.get('CLICKUP_LISTA_INSTALACAO') || '').trim()

  if (!token) {
    return e.json(400, { error: 'Configure o token do ClickUp (secret CLICKUP_TOKEN).' })
  }
  if (!listaId) {
    return e.json(400, { error: 'Informe a lista de Instalação (list_id).' })
  }

  const resultados = []
  let pagina = 0
  let totalLidas = 0
  let criadas = 0
  let existentes = 0
  let semChecklist = 0

  while (pagina < 20) {
    const res = $http.send({
      url:
        'https://api.clickup.com/api/v2/list/' +
        listaId +
        '/task?page=' +
        pagina +
        '&subtasks=true',
      method: 'GET',
      headers: { Authorization: token, 'Content-Type': 'application/json' },
      timeout: 30,
    })

    if (res.statusCode !== 200) {
      return e.json(502, {
        error: 'ClickUp respondeu ' + res.statusCode + ' na lista ' + listaId,
        pagina: pagina,
        resultados: resultados,
      })
    }

    const tarefas = (res.json || {}).tasks || []
    if (tarefas.length === 0) break
    totalLidas += tarefas.length

    for (let i = 0; i < tarefas.length; i++) {
      const tarefa = tarefas[i]

      // só a tarefa-mãe vira OS; subtarefa é etapa interna da obra
      if (tarefa.parent) continue

      const jaExiste = $app.findRecordsByFilter('ordens', 'clickup_task_id = {:id}', '', 1, 0, {
        id: String(tarefa.id),
      })
      if (jaExiste.length > 0) {
        existentes++
        continue
      }

      // a obra é o cliente/projeto; casa pelo nome da tarefa
      let obra = null
      const porNome = $app.findRecordsByFilter('obras', 'nome = {:nome}', '', 1, 0, {
        nome: String(tarefa.name || '').trim(),
      })
      if (porNome.length > 0) {
        obra = porNome[0]
      } else {
        obra = new Record($app.findCollectionByNameOrId('obras'))
        obra.set('nome', String(tarefa.name || 'Sem nome').trim())
        obra.set('status', 'executando')
        $app.save(obra)
        resultados.push({ obra_criada: String(obra.get('nome')) })
      }

      // numeração sequencial
      let proximo = 1
      const ultimas = $app.findRecordsByFilter('ordens', '', '-numero', 1, 0)
      if (ultimas.length > 0) {
        const n = String(ultimas[0].get('numero') || '')
        const m = n.match(/(\d+)\s*$/)
        if (m) proximo = parseInt(m[1], 10) + 1
      }

      const statusClickup = String((tarefa.status || {}).status || '')
      let status = 'aberta'
      if (statusClickup === 'executando') status = 'em_execucao'
      if (statusClickup === 'finalizado' || statusClickup === 'concluido') status = 'concluida'

      const ordem = new Record($app.findCollectionByNameOrId('ordens'))
      ordem.set('obra', obra.id)
      ordem.set('numero', 'OS-' + String(proximo).padStart(3, '0'))
      ordem.set('status', status)
      ordem.set('clickup_task_id', String(tarefa.id))
      ordem.set('clickup_task_url', String(tarefa.url || ''))
      ordem.set('clickup_status', statusClickup)
      ordem.set('descricao', String(tarefa.name || ''))
      if (tarefa.due_date) {
        ordem.set('data_prevista', new Date(parseInt(tarefa.due_date, 10)).toISOString())
      }
      $app.save(ordem)
      criadas++

      // checklists do ClickUp viram ambientes + itens da OS
      const checklists = tarefa.checklists || []
      if (checklists.length === 0) semChecklist++

      for (let c = 0; c < checklists.length; c++) {
        const checklist = checklists[c]

        const ambEncontrados = $app.findRecordsByFilter(
          'ambientes',
          'obra = {:obra} && nome = {:nome}',
          '',
          1,
          0,
          { obra: obra.id, nome: String(checklist.name || 'Geral') },
        )
        let ambiente
        if (ambEncontrados.length > 0) {
          ambiente = ambEncontrados[0]
        } else {
          ambiente = new Record($app.findCollectionByNameOrId('ambientes'))
          ambiente.set('obra', obra.id)
          ambiente.set('nome', String(checklist.name || 'Geral'))
          ambiente.set('ordem', c)
          $app.save(ambiente)
        }

        const itensDoChecklist = checklist.items || []
        for (let k = 0; k < itensDoChecklist.length; k++) {
          const itemClickup = itensDoChecklist[k]
          const registro = new Record($app.findCollectionByNameOrId('itens'))
          registro.set('obra', obra.id)
          registro.set('ambiente', ambiente.id)
          // `ordem_servico` = relação com a OS; `ordem` = posição do item
          registro.set('ordem_servico', ordem.id)
          registro.set('ordem', k)
          registro.set('nome', String(itemClickup.name || ''))
          registro.set('concluido', itemClickup.resolved === true)
          registro.set('clickup_item_id', String(itemClickup.id || ''))
          registro.set('clickup_checklist_id', String(checklist.id || ''))
          if (itemClickup.resolved === true) {
            registro.set('concluido_em', new Date().toISOString())
          }
          $app.save(registro)
        }
      }

      resultados.push({
        os: String(ordem.get('numero')),
        tarefa: String(ordem.get('descricao')),
        status_clickup: statusClickup,
        ambientes: checklists.length,
      })
    }

    if ((res.json || {}).last_page === true) break
    pagina++
  }

  return e.json(200, {
    lidas: totalLidas,
    os_criadas: criadas,
    ja_existiam: existentes,
    os_sem_checklist: semChecklist,
    detalhe: resultados,
  })
})
