/* Movimentos bancários vindos do BTG por webhook.

   Por que esta tabela existe: hoje o caixa é digitado à mão e a classificação
   de quem pagou é feita pelo NOME — foi assim que R$ 32.000 de transferência
   entre contas da própria empresa pareceram retirada de sócio. O webhook do
   BTG manda o `relatedParty.taxId` (CNPJ/CPF da contraparte) em cada
   transação, então a classificação passa a ser por documento, não por nome.

   `movimentos` guarda o fato bruto do banco. A conciliação (ligar o movimento
   a um recebimento ou pagamento já lançado) é passo separado — e é onde o
   dono confirma, porque só ele sabe o que foi cada PIX. */
migrate(
  (app) => {
    const contas = app.findCollectionByNameOrId('contas')
    const recebimentos = app.findCollectionByNameOrId('recebimentos')
    const pagamentos = app.findCollectionByNameOrId('pagamentos')

    const movimentos = new Collection({
      name: 'movimentos',
      type: 'base',
      // Dinheiro: só gestor.
      listRule: '@request.auth.perfil = "gestor"',
      viewRule: '@request.auth.perfil = "gestor"',
      // Escrita só pelo servidor (webhook). Nada de lançar movimento pela tela.
      createRule: null,
      updateRule: '@request.auth.perfil = "gestor"',
      deleteRule: '@request.auth.perfil = "gestor"',
      fields: [
        // chave de idempotência: o webhook pode reenviar o mesmo evento
        { name: 'chave', type: 'text', required: true },
        { name: 'conta_bancaria', type: 'text' },
        { name: 'conta', type: 'relation', collectionId: contas.id, maxSelect: 1 },
        { name: 'data', type: 'date' },
        { name: 'tipo', type: 'select', maxSelect: 1, values: ['credito', 'debito'] },
        { name: 'valor', type: 'number', min: 0 },
        { name: 'moeda', type: 'text' },
        // Pix, Bankslip (boleto), TED, etc.
        { name: 'meio', type: 'text' },
        { name: 'descricao', type: 'text' },
        { name: 'contraparte_nome', type: 'text' },
        // CNPJ ou CPF — o dado que substitui a classificação por nome.
        { name: 'contraparte_doc', type: 'text' },
        { name: 'end_to_end_id', type: 'text' },
        { name: 'tx_id', type: 'text' },
        { name: 'codigo_barras', type: 'text' },
        {
          name: 'classificacao',
          type: 'select',
          maxSelect: 1,
          values: [
            'entrada_cliente',
            'saida_fornecedor',
            'transferencia_pj_pj',
            'retirada_socio',
            'aporte_socio',
            'tarifa',
            'nao_classificado',
          ],
        },
        { name: 'classificado_por', type: 'text' },
        { name: 'conciliado', type: 'bool' },
        { name: 'recebimento', type: 'relation', collectionId: recebimentos.id, maxSelect: 1 },
        { name: 'pagamento', type: 'relation', collectionId: pagamentos.id, maxSelect: 1 },
        { name: 'origem', type: 'text' },
        { name: 'payload', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_mov_chave ON movimentos (chave)',
        'CREATE INDEX idx_mov_data ON movimentos (data)',
        'CREATE INDEX idx_mov_class ON movimentos (classificacao)',
      ],
    })
    app.save(movimentos)

    // ---- config: documentos para classificar sem usar nome ----
    const cfg = app.findCollectionByNameOrId('config_financeiro')
    if (!cfg.fields.getByName('cnpj_empresa')) {
      cfg.fields.add(new TextField({ name: 'cnpj_empresa' }))
    }
    if (!cfg.fields.getByName('cpf_socio')) {
      cfg.fields.add(new TextField({ name: 'cpf_socio' }))
    }
    app.save(cfg)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('movimentos'))
    } catch (_) {
      /* já não existe */
    }
    try {
      const cfg = app.findCollectionByNameOrId('config_financeiro')
      cfg.fields.removeByName('cnpj_empresa')
      cfg.fields.removeByName('cpf_socio')
      app.save(cfg)
    } catch (_) {
      /* campos já removidos */
    }
  },
)
