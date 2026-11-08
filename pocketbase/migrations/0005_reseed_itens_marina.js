// Re-semeia os itens do checklist do Marina que faltarem.
// Idempotente: a chave é ambiente + nome (nunca só o nome, porque "Spot Mini"
// existe em dois ambientes).
const AMBIENTES = [
  {
    nome: 'Suíte Master',
    itens: [
      ['Smart Station', true],
      ['Spot Mini', false],
      ['Módulos Dimmer -1', true],
      ['Módulos Reles - 2', true],
      ['Reles WC - 2', true],
      ['Dimmer 0-10 WC', true],
      ['Rele Escritório - 1', true],
      ['Dimmer 0-10 escritório', true],
      ['Persianas escritório', true],
      ['Keystone quarto', false],
      ['Keystone escritório', false],
    ],
  },
  {
    nome: 'Sala de estar',
    itens: [
      ['Spot Mini', false],
      ['Nature mini', true],
      ['Dimmer - 2', true],
      ['Rele varanda - 1', true],
      ['Cortinas varanda - 2', true],
      ['Emissor IR para Ar condicionado e TV', false],
      ['Configuração de câmeras', false],
    ],
  },
  {
    nome: 'Home Theater',
    itens: [
      ['Caixas', false],
      ['Condicionador de energia', true],
      ['Receiver', false],
      ['TV', false],
      ['Passar cabo para IR', true],
    ],
  },
]

migrate(
  (app) => {
    const obra = app.findFirstRecordByData('obras', 'nome', 'Marina')
    const itensCol = app.findCollectionByNameOrId('itens')

    AMBIENTES.forEach((ambiente) => {
      const ambientes = app.findRecordsByFilter(
        'ambientes',
        'obra = {:obra} && nome = {:nome}',
        '',
        1,
        0,
        { obra: obra.id, nome: ambiente.nome },
      )
      if (ambientes.length === 0) return
      const ambRecord = ambientes[0]

      ambiente.itens.forEach((par, itemIndex) => {
        const nome = par[0]
        const concluido = par[1]
        const existentes = app.findRecordsByFilter(
          'itens',
          'ambiente = {:ambiente} && nome = {:nome}',
          '',
          1,
          0,
          { ambiente: ambRecord.id, nome: nome },
        )
        if (existentes.length > 0) return

        const item = new Record(itensCol)
        item.set('obra', obra.id)
        item.set('ambiente', ambRecord.id)
        item.set('nome', nome)
        item.set('concluido', concluido)
        item.set('ordem', itemIndex)
        app.save(item)
      })
    })
  },
  (app) => {
    try {
      const obra = app.findFirstRecordByData('obras', 'nome', 'Marina')
      const itens = app.findRecordsByFilter('itens', 'obra = {:obra}', '', 0, 0, {
        obra: obra.id,
      })
      itens.forEach((i) => app.delete(i))
    } catch (_) {}
  },
)
