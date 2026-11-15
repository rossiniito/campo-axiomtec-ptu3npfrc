/* Recebimento por obra: sinal + parcelas com vencimento fixo.

   Decisão do Rossini em 12/11/2026: NÃO é medição. É cronograma de recebimento.
   Padrão dele: sinal 40% + 2 parcelas de 30%, variável conforme negociação —
   por isso o percentual fica gravado em cada parcela, não como regra fixa.

   Por que uma tabela e não campos na obra: a obra pode ter 2, 3 ou 5 parcelas.
   Guardar isso em campos fixos obriga a mudar o schema a cada negociação. */
migrate(
  (app) => {
    const obras = app.findCollectionByNameOrId('obras')
    const orcamentos = app.findCollectionByNameOrId('orcamentos')

    const recebimentos = new Collection({
      name: 'recebimentos',
      type: 'base',
      // Dinheiro de cliente é só do gestor. O técnico não vê valor de obra.
      listRule: '@request.auth.perfil = "gestor"',
      viewRule: '@request.auth.perfil = "gestor"',
      createRule: '@request.auth.perfil = "gestor"',
      updateRule: '@request.auth.perfil = "gestor"',
      deleteRule: '@request.auth.perfil = "gestor"',
      fields: [
        { name: 'obra', type: 'relation', collectionId: obras.id, maxSelect: 1, required: true },
        { name: 'orcamento', type: 'relation', collectionId: orcamentos.id, maxSelect: 1 },
        {
          name: 'tipo',
          type: 'select',
          maxSelect: 1,
          values: ['sinal', 'parcela'],
        },
        { name: 'descricao', type: 'text' },
        { name: 'percentual', type: 'number' },
        { name: 'valor', type: 'number', required: true, min: 0 },
        { name: 'vencimento', type: 'date', required: true },
        {
          name: 'status',
          type: 'select',
          maxSelect: 1,
          values: ['a_receber', 'recebido', 'atrasado', 'cancelado'],
        },
        { name: 'recebido_em', type: 'date' },
        { name: 'valor_recebido', type: 'number' },
        {
          name: 'forma',
          type: 'select',
          maxSelect: 1,
          values: ['pix', 'boleto', 'transferencia', 'cartao', 'dinheiro', 'cheque'],
        },
        { name: 'observacoes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_receb_obra ON recebimentos (obra)',
        'CREATE INDEX idx_receb_venc ON recebimentos (vencimento)',
        'CREATE INDEX idx_receb_status ON recebimentos (status)',
      ],
    })
    app.save(recebimentos)

    // Conta a pagar da compra: o outro lado do caixa.
    // Sem isso o app mostra dinheiro entrando e esconde a saída, e a projeção mente.
    const fornecedores = app.findCollectionByNameOrId('fornecedores')
    const pagamentos = new Collection({
      name: 'pagamentos',
      type: 'base',
      listRule: '@request.auth.perfil = "gestor"',
      viewRule: '@request.auth.perfil = "gestor"',
      createRule: '@request.auth.perfil = "gestor"',
      updateRule: '@request.auth.perfil = "gestor"',
      deleteRule: '@request.auth.perfil = "gestor"',
      fields: [
        { name: 'descricao', type: 'text', required: true },
        { name: 'fornecedor', type: 'relation', collectionId: fornecedores.id, maxSelect: 1 },
        { name: 'obra', type: 'relation', collectionId: obras.id, maxSelect: 1 },
        { name: 'valor', type: 'number', required: true, min: 0 },
        { name: 'vencimento', type: 'date', required: true },
        {
          name: 'status',
          type: 'select',
          maxSelect: 1,
          values: ['a_pagar', 'pago', 'atrasado', 'cancelado'],
        },
        { name: 'pago_em', type: 'date' },
        { name: 'valor_pago', type: 'number' },
        {
          name: 'categoria',
          type: 'select',
          maxSelect: 1,
          values: ['equipamento', 'terceiros', 'imposto', 'folha', 'estrutura', 'outro'],
        },
        { name: 'observacoes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_pag_venc ON pagamentos (vencimento)',
        'CREATE INDEX idx_pag_status ON pagamentos (status)',
      ],
    })
    app.save(pagamentos)
  },
  (app) => {
    for (const nome of ['pagamentos', 'recebimentos']) {
      try {
        app.delete(app.findCollectionByNameOrId(nome))
      } catch (_) {
        /* já não existe */
      }
    }
  },
)
