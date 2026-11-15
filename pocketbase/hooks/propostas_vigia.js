/* Vigia de propostas: encontra a proposta que esfriou e diz o que fazer.

   Roda todo dia às 11:00 UTC (08:00 de Brasília), antes do dia comercial
   começar — o alerta chega quando ainda dá tempo de ligar.

   Regra de esfriamento, por estágio (o que a proposta precisa e não recebeu):
     enviada, nunca aberta ......... 3 dias sem abertura  → pode não ter chegado
     visualizada, sem aceite ....... 2 dias sem atividade  → viu o preço e sumiu
     aberta 3+ vezes, sem aceite ... 1 dia sem atividade   → está decidindo, ligue
     total parada há 10 dias ....... qualquer estágio      → decide ou descarta

   O alerta é só para o gestor (decisão do Rossini em 12/11/2026: ele centraliza
   o follow-up). Não manda e-mail: devolve a lista, e o agente entrega no chat. */
const DIAS_MS = 24 * 60 * 60 * 1000

cronAdd('propostas_vigia', '0 11 * * *', () => {
  const agora = Date.now()

  let propostas = []
  try {
    propostas = $app.findRecordsByFilter('propostas', '', '-ultima_atividade', 500, 0)
  } catch (_) {
    propostas = []
  }

  const alertas = []
  const emAberto = { enviada: 0, visualizada: 0 }

  for (let i = 0; i < propostas.length; i++) {
    const p = propostas[i]
    const status = String(p.getString('status') || '')

    if (status === 'aceita' || status === 'recusada' || status === 'expirada') continue
    if (status === 'enviada') emAberto.enviada++
    if (status === 'visualizada') emAberto.visualizada++

    const enviadaEm = p.getString('enviada_em') || p.getString('created')
    const abertura = p.getString('primeira_abertura')
    const atividade = p.getString('ultima_atividade') || abertura || enviadaEm
    const visitas = p.getInt('visitas') || 0

    const referencia = atividade ? new Date(atividade).getTime() : null
    if (!referencia) continue
    const diasParada = Math.floor((agora - referencia) / DIAS_MS)

    let motivo = ''
    let prioridade = ''
    let acao = ''

    if (status === 'enviada' && !abertura && diasParada >= 3) {
      motivo = 'enviada há ' + diasParada + ' dias e nunca foi aberta'
      prioridade = 'alta'
      acao =
        'Confirme se o cliente recebeu o link. Pode ter caído em spam ou o e-mail estar errado.'
    } else if (status === 'visualizada' && visitas >= 3 && diasParada >= 1) {
      motivo = 'aberta ' + visitas + ' vezes e parada há ' + diasParada + ' dia(s)'
      prioridade = 'alta'
      acao =
        'Ela voltou várias vezes: está pesando a decisão. Ligue hoje, ofereça ajuste de escopo.'
    } else if (status === 'visualizada' && diasParada >= 2) {
      motivo = 'visualizada e sem resposta há ' + diasParada + ' dias'
      prioridade = 'normal'
      acao = 'Primeiro retorno: pergunte se ficou alguma dúvida no escopo ou no prazo.'
    } else if (diasParada >= 10) {
      motivo = 'parada há ' + diasParada + ' dias no estágio "' + status + '"'
      prioridade = 'normal'
      acao =
        'Decida: fazer uma última tentativa com prazo, ou marcar como perdida e liberar a agenda.'
    }

    if (motivo) {
      alertas.push({
        proposta_id: p.getString('proposta_id'),
        cliente: p.getString('cliente') || '',
        projeto: p.getString('projeto') || '',
        valor: p.getInt('valor') || 0,
        status: status,
        visitas: visitas,
        dias_parada: diasParada,
        motivo: motivo,
        prioridade: prioridade,
        acao: acao,
      })
    }
  }

  // mais urgente primeiro
  alertas.sort((a, b) => {
    const peso = { alta: 0, normal: 1 }
    const d = (peso[a.prioridade] || 1) - (peso[b.prioridade] || 1)
    return d !== 0 ? d : b.dias_parada - a.dias_parada
  })

  $app
    .logger()
    .info(
      'vigia de propostas executado',
      'alertas',
      alertas.length,
      'enviadas_abertas',
      emAberto.enviada,
      'visualizadas_abertas',
      emAberto.visualizada,
    )

  // Guarda o resultado para o agente ler ao entregar o alerta, sem recalcular.
  try {
    let resumo = null
    try {
      resumo = $app.findFirstRecordByFilter('vigia_resultado', 'chave = "propostas"', {})
    } catch (_) {
      resumo = null
    }
    if (!resumo) {
      resumo = new Record($app.findCollectionByNameOrId('vigia_resultado'))
      resumo.set('chave', 'propostas')
    }
    resumo.set('executado_em', new Date().toISOString())
    resumo.set('total_alertas', alertas.length)
    resumo.set('conteudo', JSON.stringify(alertas))
    $app.save(resumo)
  } catch (err) {
    $app.logger().error('nao foi possivel gravar resultado do vigia', 'erro', String(err))
  }

  return alertas.length
})
