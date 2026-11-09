// Ordens de serviço: a unidade de trabalho que o técnico executa no dia.
// Nasce de uma tarefa de Instalação do ClickUp e mantém o vínculo para sincronizar.
migrate(
  (app) => {
    const obrasId = app.findCollectionByNameOrId('obras').id

    const os = new Collection({
      name: 'ordens',
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
        { name: 'numero', type: 'text', required: true },
        {
          name: 'status',
          type: 'select',
          maxSelect: 1,
          values: ['aberta', 'em_execucao', 'concluida', 'cancelada'],
        },
        { name: 'clickup_task_id', type: 'text' },
        { name: 'clickup_task_url', type: 'text' },
        { name: 'clickup_status', type: 'text' },
        { name: 'descricao', type: 'text' },
        { name: 'tecnico', type: 'text' },
        { name: 'data_prevista', type: 'date' },
        { name: 'checkin_em', type: 'date' },
        { name: 'checkout_em', type: 'date' },
        { name: 'pendencia_cliente', type: 'text' },
        { name: 'sincronizada_em', type: 'date' },
        { name: 'ultimo_erro_sync', type: 'text' },
        { name: 'observacao_sync', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_ordens_numero ON ordens (numero)',
        'CREATE UNIQUE INDEX idx_ordens_clickup ON ordens (clickup_task_id) WHERE clickup_task_id != ""',
      ],
    })
    app.save(os)
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('ordens'))
  },
)
