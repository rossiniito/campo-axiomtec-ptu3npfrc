// Aplica a situação real das obras informada pelo Rossini em 15/11/2026.
//
// Idempotente: procura a obra pelo nome (sem acento e sem caixa) e atualiza;
// se não existir, cria. Rodar de novo não duplica nem sobrescreve o que já
// está certo.
//
// Marina fica de fora de propósito: o status dela já está correto no sistema
// e sobrescrever apagaria informação de campo.
migrate(
  (app) => {
    function normalizar(t) {
      return String(t || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
    }

    const situacoes = [
      {
        nome: 'Em Sherif',
        status: 'ajustes_finais',
        situacao: 'Instalação finalizada, faltando pequenos ajustes.',
      },
      {
        nome: 'ACMassi',
        status: 'entregue',
        situacao: 'Obra entregue.',
      },
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
        const n = normalizar(todas[j].get('nome'))
        // casa "Em Sherif" com "Em Sherif Restaurante" e vice-versa
        if (n === alvoNorm || n.indexOf(alvoNorm) === 0 || alvoNorm.indexOf(n) === 0) {
          obra = todas[j]
          break
        }
      }

      if (!obra) {
        obra = new Record(app.findCollectionByNameOrId('obras'))
        obra.set('nome', alvo.nome)
        obra.set('cliente', alvo.nome)
      }

      obra.set('status', alvo.status)
      obra.set('situacao', alvo.situacao)
      obra.set('status_em', agora)
      app.save(obra)
    }
  },
  (app) => {
    // não desfaz: apagar status de obra real seria pior que manter
  },
)
