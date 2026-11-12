/* Fase 2 — financeiro: despesa de campo e margem por obra.

   Decisão do Rossini em 12/11/2026: Bling fica para nota fiscal e caixa;
   a margem por obra nasce aqui.

   Decisão de modelagem importante: **não** criar uma tabela "compras" separada
   de "despesas". O custo de material já mora em `equipamentos.valor_compra`
   (ligado à obra). Criar outra tabela de compra faria o mesmo gasto ser contado
   duas vezes e a margem sairia falsa — sempre para baixo, escondendo obra boa.
   Aqui entra só o que NÃO é equipamento: combustível, alimentação, pedágio,
   hospedagem, material de consumo, terceiros e frete.

   Margem = valor aprovado (orçamentos) − equipamentos da obra − despesas aprovadas. */
migrate(
  (app) => {
    const obras = app.findCollectionByNameOrId('obras')

    const despesas = new Collection({
      name: 'despesas',
      type: 'base',
      // Técnico vê as suas e as das obras onde está alocado; gestor vê tudo.
      listRule:
        '@request.auth.id != "" && (@request.auth.perfil = "gestor" || tecnico = @request.auth.id)',
      viewRule:
        '@request.auth.id != "" && (@request.auth.perfil = "gestor" || tecnico = @request.auth.id)',
      // Técnico só lança em nome próprio. A aprovação do gestor é o que libera o reembolso.
      createRule: '@request.auth.id != "" && tecnico = @request.auth.id',
      // Técnico corrige o próprio lançamento enquanto não foi aprovado.
      updateRule:
        '@request.auth.id != "" && (@request.auth.perfil = "gestor" || (tecnico = @request.auth.id && status = "pendente"))',
      deleteRule:
        '@request.auth.id != "" && (@request.auth.perfil = "gestor" || (tecnico = @request.auth.id && status = "pendente"))',
      fields: [
        { name: 'descricao', type: 'text', required: true },
        {
          name: 'tipo',
          type: 'select',
          maxSelect: 1,
          values: [
            'combustivel',
            'alimentacao',
            'pedagio',
            'hospedagem',
            'material_consumo',
            'terceiros',
            'frete',
            'ferramenta',
            'outro',
          ],
        },
        { name: 'valor', type: 'number', required: true, min: 0 },
        { name: 'data', type: 'date' },
        { name: 'obra', type: 'relation', collectionId: obras.id, maxSelect: 1, required: true },
        {
          name: 'tecnico',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
          required: true,
        },
        { name: 'comprovante', type: 'file', maxSelect: 5, maxSize: 8000000, protected: true },
        { name: 'observacoes', type: 'text' },
        {
          name: 'status',
          type: 'select',
          maxSelect: 1,
          values: ['pendente', 'aprovado', 'reembolsado', 'recusado'],
        },
        { name: 'aprovado_por', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 1 },
        { name: 'aprovado_em', type: 'date' },
        { name: 'motivo_recusa', type: 'text' },
        { name: 'pago_em', type: 'date' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_despesas_obra ON despesas (obra)',
        'CREATE INDEX idx_despesas_tecnico ON despesas (tecnico)',
        'CREATE INDEX idx_despesas_status ON despesas (status)',
      ],
    })
    app.save(despesas)

    // Data de aprovação do orçamento por padrão = hoje, para não ficar vazio.
    // (campo já existe; nada a fazer, só registro da intenção)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('despesas'))
    } catch (_) {
      /* já não existe */
    }
  },
)
