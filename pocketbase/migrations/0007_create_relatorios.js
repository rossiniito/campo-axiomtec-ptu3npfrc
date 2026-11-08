// Relatórios de entrega ao cliente: guarda a assinatura e o snapshot do que foi
// apresentado, para o PDF poder ser reemitido idêntico meses depois.
migrate(
  (app) => {
    const obrasId = app.findCollectionByNameOrId('obras').id

    const relatorios = new Collection({
      name: 'relatorios',
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
        { name: 'titulo', type: 'text' },
        { name: 'nome_responsavel', type: 'text' },
        { name: 'observacoes', type: 'text' },
        {
          name: 'assinatura_cliente',
          type: 'file',
          maxSelect: 1,
          maxSize: 2000000,
          mimeTypes: ['image/png'],
        },
        {
          name: 'assinatura_tecnico',
          type: 'file',
          maxSelect: 1,
          maxSize: 2000000,
          mimeTypes: ['image/png'],
        },
        { name: 'assinado_em', type: 'date' },
        { name: 'enviado_em', type: 'date' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(relatorios)
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('relatorios'))
  },
)
