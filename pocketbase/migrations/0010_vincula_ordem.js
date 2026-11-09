// Liga itens e relatórios à OS, e guarda os ids do ClickUp.
// IMPORTANTE: em `itens` já existe o campo numérico `ordem` (posição do item na
// lista). Por isso a relação com a OS chama-se `ordem_servico` — usar `ordem`
// sobrescreveria a posição e embaralharia o checklist.
// Sem o par checklist_id + item_id a sincronização não consegue marcar o item
// certo: casar por nome falha quando o mesmo nome aparece em dois ambientes.
migrate(
  (app) => {
    const ordensId = app.findCollectionByNameOrId('ordens').id

    const itens = app.findCollectionByNameOrId('itens')
    if (!itens.fields.getByName('ordem_servico')) {
      itens.fields.add(
        new RelationField({
          name: 'ordem_servico',
          required: false,
          collectionId: ordensId,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
    }
    if (!itens.fields.getByName('clickup_item_id')) {
      itens.fields.add(new TextField({ name: 'clickup_item_id' }))
    }
    if (!itens.fields.getByName('clickup_checklist_id')) {
      itens.fields.add(new TextField({ name: 'clickup_checklist_id' }))
    }
    app.save(itens)

    const relatorios = app.findCollectionByNameOrId('relatorios')
    if (!relatorios.fields.getByName('ordem_servico')) {
      relatorios.fields.add(
        new RelationField({
          name: 'ordem_servico',
          required: false,
          collectionId: ordensId,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
    }
    app.save(relatorios)

    // devolve uma OS às tarefas de instalação que já existiam no app
    const obras = app.findAllRecords('obras')
    for (let i = 0; i < obras.length; i++) {
      const obra = obras[i]
      const existentes = app.findRecordsByFilter('ordens', 'obra = {:obra}', '', 1, 0, {
        obra: obra.id,
      })
      if (existentes.length > 0) continue

      const ordem = new Record(app.findCollectionByNameOrId('ordens'))
      ordem.set('obra', obra.id)
      ordem.set('numero', 'OS-' + String(i + 1).padStart(3, '0'))
      ordem.set('status', 'aberta')
      ordem.set('descricao', String(obra.get('nome') || ''))
      app.save(ordem)

      const itensDaObra = app.findRecordsByFilter('itens', 'obra = {:obra}', '', 2000, 0, {
        obra: obra.id,
      })
      for (let j = 0; j < itensDaObra.length; j++) {
        const item = itensDaObra[j]
        item.set('ordem_servico', ordem.id)
        app.save(item)
      }
    }
  },
  (app) => {
    const itens = app.findCollectionByNameOrId('itens')
    itens.fields.removeByName('ordem_servico')
    itens.fields.removeByName('clickup_item_id')
    itens.fields.removeByName('clickup_checklist_id')
    app.save(itens)

    const relatorios = app.findCollectionByNameOrId('relatorios')
    relatorios.fields.removeByName('ordem_servico')
    app.save(relatorios)
  },
)
