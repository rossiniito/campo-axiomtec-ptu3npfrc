/* Sincronização noturna: leva para o ClickUp o que o técnico fez em campo.

   Faz três coisas por OS ainda não sincronizada:
   1. marca no ClickUp cada item do checklist que o técnico marcou aqui;
   2. grava a pendência do cliente no campo "Alguma pendência por parte do cliente?";
   3. comenta na tarefa o resumo do dia.

   Só marca item como resolvido: o app nunca desmarca um item no ClickUp, para
   não apagar trabalho que alguém tenha feito lá. Se falhar, guarda o erro na
   própria OS para aparecer no app em vez de sumir. */
cronAdd('sincronizar_clickup', '0 3 * * *', () => {
  const token = String($secrets.get('CLICKUP_TOKEN') || '').trim()
  if (!token) return

  const pendentes = $app.findRecordsByFilter(
    'ordens',
    'clickup_task_id != "" && sincronizada_em = ""',
    '',
    100,
    0,
  )

  for (let i = 0; i < pendentes.length; i++) {
    const ordem = pendentes[i]
    const taskId = String(ordem.get('clickup_task_id'))
    const problemas = []

    // --- 1. itens do checklist ---
    const itens = $app.findRecordsByFilter(
      'itens',
      'ordem_servico = {:os} && concluido = true && clickup_item_id != ""',
      '',
      500,
      0,
      { os: ordem.id },
    )

    for (let j = 0; j < itens.length; j++) {
      const item = itens[j]
      const checklistId = String(item.get('clickup_checklist_id'))
      const itemId = String(item.get('clickup_item_id'))
      if (!checklistId || !itemId) continue

      const res = $http.send({
        url:
          'https://api.clickup.com/api/v2/checklist/' + checklistId + '/checklist_item/' + itemId,
        method: 'PUT',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolved: true }),
        timeout: 20,
      })
      if (res.statusCode !== 200 && res.statusCode !== 204) {
        problemas.push('item ' + String(item.get('nome')) + ': HTTP ' + res.statusCode)
      }
    }

    // --- 2. pendência do cliente (campo customizado) ---
    const campoPendencia = String($secrets.get('CLICKUP_FIELD_PENDENCIA') || '').trim()
    const pendencia = String(ordem.get('pendencia_cliente') || '').trim()
    if (campoPendencia && pendencia) {
      const res = $http.send({
        url: 'https://api.clickup.com/api/v2/task/' + taskId + '/field/' + campoPendencia,
        method: 'POST',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: pendencia }),
        timeout: 20,
      })
      if (res.statusCode !== 200 && res.statusCode !== 204) {
        problemas.push('pendência: HTTP ' + res.statusCode)
      }
    }

    // --- 3. comentário com o resumo ---
    const total = $app.findRecordsByFilter('itens', 'ordem_servico = {:os}', '', 500, 0, {
      os: ordem.id,
    })
    let feitos = 0
    for (let t = 0; t < total.length; t++) {
      if (total[t].get('concluido') === true) feitos++
    }

    const linhas = []
    linhas.push('**OS ' + String(ordem.get('numero')) + ' — ' + String(ordem.get('status')) + '**')
    linhas.push('Checklist: ' + feitos + ' de ' + total.length + ' itens concluídos')
    if (ordem.get('tecnico')) linhas.push('Técnico: ' + String(ordem.get('tecnico')))
    if (ordem.get('checkin_em')) linhas.push('Entrada: ' + String(ordem.get('checkin_em')))
    if (ordem.get('checkout_em')) linhas.push('Saída: ' + String(ordem.get('checkout_em')))
    if (pendencia) linhas.push('Pendência do cliente: ' + pendencia)
    linhas.push('Sincronizado automaticamente pelo Campo AxiomTec.')

    const resComentario = $http.send({
      url: 'https://api.clickup.com/api/v2/task/' + taskId + '/comment',
      method: 'POST',
      headers: { Authorization: token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment_text: linhas.join('\n'), notify_all: false }),
      timeout: 20,
    })
    if (resComentario.statusCode !== 200) {
      problemas.push('comentário: HTTP ' + resComentario.statusCode)
    }

    // --- estado da OS ---
    if (problemas.length === 0) {
      ordem.set('sincronizada_em', new Date().toISOString())
      ordem.set('ultimo_erro_sync', '')
      ordem.set('observacao_sync', feitos + ' de ' + total.length + ' itens enviados')
    } else {
      ordem.set('ultimo_erro_sync', problemas.join(' | ').substring(0, 900))
    }
    $app.save(ordem)
  }
})
