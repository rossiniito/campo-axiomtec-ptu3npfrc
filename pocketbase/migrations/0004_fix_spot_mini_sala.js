// Corrige o seed do Marina: "Spot Mini" existe na Suíte Master E na Sala de estar.
// A 0003 original deduplicava só pelo nome e criou um único registro.
migrate(
  (app) => {
    const obra = app.findFirstRecordByData('obras', 'nome', 'Marina')
    const ambientes = app.findRecordsByFilter(
      'ambientes',
      'obra = {:obra} && nome = {:nome}',
      '',
      1,
      0,
      { obra: obra.id, nome: 'Sala de estar' },
    )
    if (ambientes.length === 0) return
    const sala = ambientes[0]

    const existentes = app.findRecordsByFilter(
      'itens',
      'ambiente = {:ambiente} && nome = {:nome}',
      '',
      1,
      0,
      { ambiente: sala.id, nome: 'Spot Mini' },
    )
    if (existentes.length > 0) return

    const item = new Record(app.findCollectionByNameOrId('itens'))
    item.set('obra', obra.id)
    item.set('ambiente', sala.id)
    item.set('nome', 'Spot Mini')
    item.set('concluido', false)
    item.set('ordem', 0)
    app.save(item)
  },
  (app) => {
    try {
      const obra = app.findFirstRecordByData('obras', 'nome', 'Marina')
      const sala = app.findFirstRecordByData('ambientes', 'nome', 'Sala de estar')
      const itens = app.findRecordsByFilter(
        'itens',
        'obra = {:obra} && ambiente = {:ambiente} && nome = {:nome}',
        '',
        1,
        0,
        { obra: obra.id, ambiente: sala.id, nome: 'Spot Mini' },
      )
      if (itens.length > 0) app.delete(itens[0])
    } catch (_) {}
  },
)
