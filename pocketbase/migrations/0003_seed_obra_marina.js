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
    const obrasCol = app.findCollectionByNameOrId('obras')
    let obra
    try {
      obra = app.findFirstRecordByData('obras', 'nome', 'Marina')
    } catch (_) {
      obra = new Record(obrasCol)
      obra.set('nome', 'Marina')
      obra.set('cliente', 'Marina')
      obra.set('arquiteta', 'Dani Funari')
      obra.set('status', 'executando')
      obra.set('endereco', 'Projeto residencial')
      app.save(obra)
    }

    const ambCol = app.findCollectionByNameOrId('ambientes')
    const itensCol = app.findCollectionByNameOrId('itens')

    AMBIENTES.forEach((ambiente, ambienteIndex) => {
      let ambRecord
      try {
        ambRecord = app.findFirstRecordByData('ambientes', 'nome', ambiente.nome)
      } catch (_) {
        ambRecord = new Record(ambCol)
        ambRecord.set('obra', obra.id)
        ambRecord.set('nome', ambiente.nome)
        ambRecord.set('ordem', ambienteIndex)
        app.save(ambRecord)
      }

      ambiente.itens.forEach((par, itemIndex) => {
        const nome = par[0]
        const concluido = par[1]
        // "Spot Mini" existe em dois ambientes: a checagem é por ambiente + nome,
        // nunca só pelo nome, senão o segundo é descartado como duplicata.
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
      app.delete(obra)
    } catch (_) {}
  },
)
