migrate(
  (app) => {
    const obrasId = app.findCollectionByNameOrId('obras').id

    const ambientes = new Collection({
      name: 'ambientes',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        {
          name: 'obra',
          type: 'relation',
          required: true,
          collectionId: obrasId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'nome', type: 'text', required: true },
        { name: 'ordem', type: 'number', onlyInt: true },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(ambientes)

    const ambientesId = app.findCollectionByNameOrId('ambientes').id

    const itens = new Collection({
      name: 'itens',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        {
          name: 'obra',
          type: 'relation',
          required: true,
          collectionId: obrasId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'ambiente',
          type: 'relation',
          collectionId: ambientesId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'nome', type: 'text', required: true },
        { name: 'concluido', type: 'bool' },
        { name: 'observacao', type: 'text' },
        {
          name: 'foto',
          type: 'file',
          maxSelect: 1,
          maxSize: 8000000,
          mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic'],
        },
        { name: 'concluido_em', type: 'date' },
        { name: 'ordem', type: 'number', onlyInt: true },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(itens)
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('itens'))
    app.delete(app.findCollectionByNameOrId('ambientes'))
  },
)
