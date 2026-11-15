/* Contas PJ e regra de aporte.

   Decisão do Rossini em 15/11/2026: só contas PJ no sistema, para não misturar
   com pessoa física. E: se precisar de aporte, o sistema avisa.

   Três coleções:
   - `contas`        : uma linha por conta bancária PJ (+ cartão ligado a ela)
   - `aportes`       : entrada de dinheiro do sócio na PJ (PF → PJ), registrada
   - `config_financeiro` : piso de caixa e custo fixo, em linha única

   O campo `valor_terceiro` existe porque R$ 27.274,02 da RealHT estão dentro
   do caixa e vão ser devolvidos. Sem separar, esse dinheiro parece disponível
   e o dono gasta o que não é dele. */
migrate(
  (app) => {
    const contas = new Collection({
      name: 'contas',
      type: 'base',
      // Dinheiro: só gestor em tudo.
      listRule: '@request.auth.perfil = "gestor"',
      viewRule: '@request.auth.perfil = "gestor"',
      createRule: '@request.auth.perfil = "gestor"',
      updateRule: '@request.auth.perfil = "gestor"',
      deleteRule: '@request.auth.perfil = "gestor"',
      fields: [
        { name: 'nome', type: 'text', required: true },
        { name: 'banco', type: 'text' },
        {
          name: 'tipo',
          type: 'select',
          maxSelect: 1,
          // Corrente · investimento (aplicação/reserva) · capital de giro ·
          // pagamento (conta usada só para pagar) · parceria (recebe de outro)
          values: ['corrente', 'investimento', 'capital_giro', 'pagamento', 'parceria'],
        },
        { name: 'finalidade', type: 'text' },
        { name: 'saldo', type: 'number', min: 0 },
        { name: 'saldo_em', type: 'date' },
        // Parte do saldo que NÃO é da AxiomTec (ex.: RealHT).
        { name: 'valor_terceiro', type: 'number', min: 0 },
        { name: 'tem_cartao', type: 'bool' },
        { name: 'limite_cartao', type: 'number', min: 0 },
        { name: 'fatura_aberta', type: 'number', min: 0 },
        { name: 'fatura_venc', type: 'date' },
        { name: 'ativo', type: 'bool' },
        { name: 'observacoes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_contas_nome ON contas (nome)'],
    })
    app.save(contas)

    const aportes = new Collection({
      name: 'aportes',
      type: 'base',
      listRule: '@request.auth.perfil = "gestor"',
      viewRule: '@request.auth.perfil = "gestor"',
      createRule: '@request.auth.perfil = "gestor"',
      updateRule: '@request.auth.perfil = "gestor"',
      deleteRule: '@request.auth.perfil = "gestor"',
      fields: [
        { name: 'valor', type: 'number', required: true, min: 0 },
        { name: 'data', type: 'date', required: true },
        { name: 'conta', type: 'relation', collectionId: contas.id, maxSelect: 1 },
        { name: 'motivo', type: 'text' },
        {
          name: 'status',
          type: 'select',
          maxSelect: 1,
          // pendente = o sistema pediu e ele não decidiu; feito = o dinheiro entrou
          values: ['pendente', 'feito', 'cancelado'],
        },
        { name: 'observacoes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_aportes_status ON aportes (status)'],
    })
    app.save(aportes)

    const config = new Collection({
      name: 'config_financeiro',
      type: 'base',
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.perfil = "gestor"',
      updateRule: '@request.auth.perfil = "gestor"',
      deleteRule: '@request.auth.perfil = "gestor"',
      fields: [
        { name: 'chave', type: 'text', required: true },
        // Reserva mínima que ele não quer furar (2 meses de custo fixo).
        { name: 'piso_caixa', type: 'number', min: 0 },
        { name: 'custo_fixo_mensal', type: 'number', min: 0 },
        { name: 'break_even_mensal', type: 'number', min: 0 },
        { name: 'observacoes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_config_chave ON config_financeiro (chave)'],
    })
    app.save(config)

    // Semente com os números que vieram do levantamento do extrato
    // (briefing do Bot Financeiro em 15/11/2026). São ponto de partida,
    // não verdade eterna: ele pode corrigir na tela.
    const jaTem = app.findRecordsByFilter('config_financeiro', 'chave = "principal"', '', 1, 0)
    if (jaTem.length === 0) {
      const c = new Record(app.findCollectionByNameOrId('config_financeiro'))
      c.set('chave', 'principal')
      c.set('piso_caixa', 26493.58)
      c.set('custo_fixo_mensal', 13246.79)
      c.set('break_even_mensal', 32558.94)
      c.set(
        'observacoes',
        'Piso = 2 meses de custo fixo. Break-even do levantamento de 15/11/2026. Ajuste na tela se mudou.',
      )
      app.save(c)
    }
  },
  (app) => {
    for (const nome of ['config_financeiro', 'aportes', 'contas']) {
      try {
        app.delete(app.findCollectionByNameOrId(nome))
      } catch (_) {
        /* já não existe */
      }
    }
  },
)
