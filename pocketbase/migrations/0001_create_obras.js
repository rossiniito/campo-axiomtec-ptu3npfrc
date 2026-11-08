migrate(
  (app) => {
    const collection = new Collection({
      name: 'obras',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        { name: 'nome', type: 'text', required: true },
        { name: 'cliente', type: 'text' },
        { name: 'endereco', type: 'text' },
        { name: 'arquiteta', type: 'text' },
        {
          name: 'status',
          type: 'select',
          values: ['aguardando', 'executando', 'finalizado'],
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(collection)
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('obras'))
  },
)
