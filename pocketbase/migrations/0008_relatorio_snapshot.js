// Snapshot do relatório: guarda o conteúdo exato apresentado ao cliente, para
// que o PDF possa ser reemitido idêntico mesmo se o checklist mudar depois.
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('relatorios')
    if (!col.fields.getByName('conteudo')) {
      col.fields.add(new JSONField({ name: 'conteudo', maxSize: 500000 }))
    }
    if (!col.fields.getByName('total_itens')) {
      col.fields.add(new NumberField({ name: 'total_itens', onlyInt: true }))
    }
    if (!col.fields.getByName('itens_concluidos')) {
      col.fields.add(new NumberField({ name: 'itens_concluidos', onlyInt: true }))
    }
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('relatorios')
    col.fields.removeByName('conteudo')
    col.fields.removeByName('total_itens')
    col.fields.removeByName('itens_concluidos')
    app.save(col)
  },
)
