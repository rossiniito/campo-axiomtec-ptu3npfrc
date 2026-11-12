/* Ciclo completo — fase 1: o dado que faltava.

   Cria Clientes, Fornecedores, Equipamentos (série + garantia), Chamados
   (pós-venda) e Contratos (manutenção). É o buraco que hoje existe entre
   "instalei" e "o cliente voltou com problema".

   Também liga a obra ao cliente por relação, em vez de depender do nome
   digitado — hoje duas obras do mesmo cliente não se encontram no sistema. */
migrate(
  (app) => {
    // ---------- clientes ----------
    const clientes = new Collection({
      name: 'clientes',
      type: 'base',
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.perfil = "gestor"',
      updateRule: '@request.auth.perfil = "gestor"',
      deleteRule: '@request.auth.perfil = "gestor"',
      fields: [
        { name: 'nome', type: 'text', required: true },
        {
          name: 'tipo',
          type: 'select',
          maxSelect: 1,
          values: ['residencial', 'corporativo', 'condominio'],
        },
        { name: 'documento', type: 'text' },
        { name: 'email', type: 'email' },
        { name: 'telefone', type: 'text' },
        { name: 'endereco', type: 'text' },
        { name: 'arquiteta', type: 'text' },
        { name: 'observacoes', type: 'text' },
        { name: 'ativo', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_clientes_nome ON clientes (nome)'],
    })
    app.save(clientes)

    // ---------- fornecedores ----------
    const fornecedores = new Collection({
      name: 'fornecedores',
      type: 'base',
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.perfil = "gestor"',
      updateRule: '@request.auth.perfil = "gestor"',
      deleteRule: '@request.auth.perfil = "gestor"',
      fields: [
        { name: 'nome', type: 'text', required: true },
        { name: 'contato', type: 'text' },
        { name: 'telefone', type: 'text' },
        { name: 'email', type: 'email' },
        { name: 'site', type: 'text' },
        { name: 'prazo_medio_dias', type: 'number', onlyInt: true },
        { name: 'observacoes', type: 'text' },
        { name: 'ativo', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_fornecedores_nome ON fornecedores (nome)'],
    })
    app.save(fornecedores)

    // ---------- equipamentos: série e garantia ----------
    const equipamentos = new Collection({
      name: 'equipamentos',
      type: 'base',
      listRule:
        '@request.auth.id != "" && (@request.auth.perfil = "gestor" || obra.tecnicos ~ @request.auth.id)',
      viewRule:
        '@request.auth.id != "" && (@request.auth.perfil = "gestor" || obra.tecnicos ~ @request.auth.id)',
      createRule: '@request.auth.perfil = "gestor"',
      updateRule:
        '@request.auth.id != "" && (@request.auth.perfil = "gestor" || obra.tecnicos ~ @request.auth.id)',
      deleteRule: '@request.auth.perfil = "gestor"',
      fields: [
        { name: 'nome', type: 'text', required: true },
        { name: 'marca', type: 'text' },
        { name: 'modelo', type: 'text' },
        { name: 'numero_serie', type: 'text' },
        { name: 'patrimonio', type: 'text' },
        { name: 'cliente', type: 'relation', collectionId: clientes.id, maxSelect: 1 },
        {
          name: 'obra',
          type: 'relation',
          collectionId: app.findCollectionByNameOrId('obras').id,
          maxSelect: 1,
        },
        { name: 'fornecedor', type: 'relation', collectionId: fornecedores.id, maxSelect: 1 },
        { name: 'data_compra', type: 'date' },
        { name: 'valor_compra', type: 'number' },
        { name: 'garantia_meses', type: 'number', onlyInt: true },
        { name: 'garantia_ate', type: 'date' },
        { name: 'nota_fiscal_numero', type: 'text' },
        {
          name: 'nota_fiscal_arquivo',
          type: 'file',
          maxSelect: 1,
          maxSize: 8000000,
          protected: true,
        },
        { name: 'local_instalacao', type: 'text' },
        { name: 'ip', type: 'text' },
        { name: 'mac', type: 'text' },
        {
          name: 'status',
          type: 'select',
          maxSelect: 1,
          values: ['em_estoque', 'instalado', 'com_defeito', 'em_garantia', 'devolvido'],
        },
        { name: 'observacoes', type: 'text' },
        {
          name: 'foto',
          type: 'file',
          maxSelect: 5,
          maxSize: 8000000,
          protected: true,
          mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_equip_serie ON equipamentos (numero_serie) WHERE numero_serie != ""',
        'CREATE INDEX idx_equip_obra ON equipamentos (obra)',
        'CREATE INDEX idx_equip_cliente ON equipamentos (cliente)',
      ],
    })
    app.save(equipamentos)

    // ---------- chamados: pós-venda e garantia ----------
    const chamados = new Collection({
      name: 'chamados',
      type: 'base',
      listRule:
        '@request.auth.id != "" && (@request.auth.perfil = "gestor" || tecnico = @request.auth.id || obra.tecnicos ~ @request.auth.id)',
      viewRule:
        '@request.auth.id != "" && (@request.auth.perfil = "gestor" || tecnico = @request.auth.id || obra.tecnicos ~ @request.auth.id)',
      createRule: '@request.auth.id != ""',
      updateRule:
        '@request.auth.id != "" && (@request.auth.perfil = "gestor" || tecnico = @request.auth.id || obra.tecnicos ~ @request.auth.id)',
      deleteRule: '@request.auth.perfil = "gestor"',
      fields: [
        { name: 'numero', type: 'text', required: true },
        { name: 'titulo', type: 'text', required: true },
        { name: 'descricao', type: 'text' },
        {
          name: 'cliente',
          type: 'relation',
          collectionId: clientes.id,
          maxSelect: 1,
          required: true,
        },
        {
          name: 'obra',
          type: 'relation',
          collectionId: app.findCollectionByNameOrId('obras').id,
          maxSelect: 1,
        },
        { name: 'equipamento', type: 'relation', collectionId: equipamentos.id, maxSelect: 1 },
        {
          name: 'tipo',
          type: 'select',
          maxSelect: 1,
          values: ['corretiva', 'preventiva', 'garantia', 'instalacao', 'duvida'],
        },
        {
          name: 'prioridade',
          type: 'select',
          maxSelect: 1,
          values: ['baixa', 'normal', 'alta', 'urgente'],
        },
        {
          name: 'status',
          type: 'select',
          maxSelect: 1,
          values: ['aberto', 'agendado', 'em_andamento', 'resolvido', 'cancelado'],
        },
        { name: 'tecnico', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 1 },
        { name: 'aberto_em', type: 'date' },
        { name: 'agendado_para', type: 'date' },
        { name: 'fechado_em', type: 'date' },
        { name: 'coberto_garantia', type: 'bool' },
        { name: 'custo', type: 'number' },
        { name: 'solucao', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_chamados_numero ON chamados (numero)',
        'CREATE INDEX idx_chamados_status ON chamados (status)',
      ],
    })
    app.save(chamados)

    // ---------- contratos: receita recorrente ----------
    const contratos = new Collection({
      name: 'contratos',
      type: 'base',
      listRule: '@request.auth.perfil = "gestor"',
      viewRule: '@request.auth.perfil = "gestor"',
      createRule: '@request.auth.perfil = "gestor"',
      updateRule: '@request.auth.perfil = "gestor"',
      deleteRule: '@request.auth.perfil = "gestor"',
      fields: [
        { name: 'nome', type: 'text', required: true },
        {
          name: 'cliente',
          type: 'relation',
          collectionId: clientes.id,
          maxSelect: 1,
          required: true,
        },
        {
          name: 'tipo',
          type: 'select',
          maxSelect: 1,
          values: ['manutencao', 'monitoramento', 'suporte', 'misto'],
        },
        { name: 'inicio', type: 'date' },
        { name: 'fim', type: 'date' },
        { name: 'valor', type: 'number' },
        {
          name: 'periodicidade',
          type: 'select',
          maxSelect: 1,
          values: ['mensal', 'trimestral', 'semestral', 'anual'],
        },
        { name: 'visitas_por_ano', type: 'number', onlyInt: true },
        {
          name: 'status',
          type: 'select',
          maxSelect: 1,
          values: ['ativo', 'suspenso', 'encerrado'],
        },
        { name: 'observacoes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_contratos_cliente ON contratos (cliente)'],
    })
    app.save(contratos)

    // ---------- obra passa a apontar para o cliente ----------
    const obras = app.findCollectionByNameOrId('obras')
    if (!obras.fields.getByName('cliente_ref')) {
      obras.fields.add(
        new RelationField({
          name: 'cliente_ref',
          collectionId: clientes.id,
          maxSelect: 1,
          minSelect: 0,
          cascadeDelete: false,
        }),
      )
      app.save(obras)
    }

    // ---------- migra o texto de cliente que já existe para a nova base ----------
    const existentes = app.findRecordsByFilter('obras', '', '', 500, 0)
    for (let i = 0; i < existentes.length; i++) {
      const obra = existentes[i]
      const nomeCliente = String(obra.get('cliente') || obra.get('nome') || '').trim()
      if (!nomeCliente) continue
      if (String(obra.get('cliente_ref') || '')) continue

      let cliente = null
      const achados = app.findRecordsByFilter('clientes', 'nome = {:n}', '', 1, 0, {
        n: nomeCliente,
      })
      if (achados.length > 0) {
        cliente = achados[0]
      } else {
        cliente = new Record(app.findCollectionByNameOrId('clientes'))
        cliente.set('nome', nomeCliente)
        cliente.set('ativo', true)
        app.save(cliente)
      }
      obra.set('cliente_ref', cliente.id)
      app.save(obra)
    }
  },
  (app) => {
    const obras = app.findCollectionByNameOrId('obras')
    obras.fields.removeByName('cliente_ref')
    app.save(obras)

    const nomes = ['contratos', 'chamados', 'equipamentos', 'fornecedores', 'clientes']
    for (let i = 0; i < nomes.length; i++) {
      try {
        app.delete(app.findCollectionByNameOrId(nomes[i]))
      } catch (_) {
        /* já não existe */
      }
    }
  },
)
