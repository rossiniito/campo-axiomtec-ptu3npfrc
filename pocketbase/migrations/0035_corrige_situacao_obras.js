// Correção da 0033: lá eu casava por PREFIXO de nome (indexOf === 0), o que
// podia aplicar a situação em obra errada ("Marina" casaria com
// "Marina Home Theater"). Aqui uso comparação exata normalizada e crio a obra
// só quando não existe nenhuma com o mesmo nome — idempotente.
// ATENÇÃO: em migration o objeto é `app`, não `$app` ($app é só em hooks).
migrate(
  (app) => {
    function normalizar(t) {
      return String(t || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
    }

    const situacoes = [
      {
        nome: 'Em Sherif',
        status: 'ajustes_finais',
        situacao: 'Instalação finalizada, faltando pequenos ajustes.',
      },
      { nome: 'ACMassi', status: 'entregue', situacao: 'Obra entregue.' },
      {
        nome: 'Laise',
        status: 'aguardando_terceiros',
        situacao:
          'Equipe da engenharia está montando a infraestrutura. A AxiomTec entra depois para passagem de cabos.',
      },
      {
        nome: 'Daniel Caraguá',
        status: 'visita_tecnica',
        situacao: 'Visita técnica para ajustes no sistema iRidium.',
      },
    ]

    const todas = app.findAllRecords('obras')
    const agora = new Date().toISOString()

    for (let i = 0; i < situacoes.length; i++) {
      const alvo = situacoes[i]
      const alvoNorm = normalizar(alvo.nome)

      let obra = null
      for (let j = 0; j < todas.length; j++) {
        if (normalizar(todas[j].get('nome')) === alvoNorm) {
          obra = todas[j]
          break
        }
      }

      if (!obra) {
        obra = new Record(app.findCollectionByNameOrId('obras'))
        obra.set('nome', alvo.nome)
        obra.set('cliente', alvo.nome)
        obra.set('status', alvo.status)
        obra.set('situacao', alvo.situacao)
        obra.set('status_em', agora)
        app.save(obra)
      } else {
        // não sobrescreve o que já tiver sido ajustado na tela
        const atual = String(obra.get('status') || '')
        if (
          atual === 'aguardando' ||
          atual === 'executando' ||
          atual === 'finalizado' ||
          atual === ''
        ) {
          obra.set('status', alvo.status)
          obra.set('status_em', agora)
        }
        if (!String(obra.get('situacao') || '').trim()) {
          obra.set('situacao', alvo.situacao)
        }
        app.save(obra)
      }
    }
  },
  (app) => {},
)
