// Orçamentos: o módulo comercial. Nasce aqui a substituição do fluxo do
// ClickUp: orçamento aprovado -> obra -> OS, tudo dentro do mesmo sistema.
// Agora há campo de VALOR, que o ClickUp nunca teve.
migrate(
  (app) => {
    const obrasId = app.findCollectionByNameOrId('obras').id

    const orcamentos = new Collection({
      name: 'orcamentos',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        { name: 'cliente', type: 'text', required: true },
        { name: 'arquiteta', type: 'text' },
        { name: 'escopo', type: 'text' },
        { name: 'valor', type: 'number' },
        {
          name: 'status',
          type: 'select',
          maxSelect: 1,
          values: ['rascunho', 'enviado', 'negociando', 'aprovado', 'perdido'],
        },
        { name: 'motivo_perda', type: 'text' },
        { name: 'data_aprovacao', type: 'date' },
        {
          name: 'obra',
          type: 'relation',
          required: false,
          collectionId: obrasId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [],
    })
    app.save(orcamentos)
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('orcamentos'))
  },
)
