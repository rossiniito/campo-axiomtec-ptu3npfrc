migrate(
  (app) => {
    // O campo "foto" passa a aceitar várias imagens por item.
    // Valores já gravados (um único arquivo) continuam válidos.
    const itens = app.findCollectionByNameOrId('itens')
    const foto = itens.fields.getByName('foto')
    foto.maxSelect = 30
    app.save(itens)
  },
  (app) => {
    const itens = app.findCollectionByNameOrId('itens')
    const foto = itens.fields.getByName('foto')
    foto.maxSelect = 1
    app.save(itens)
  },
)
