/* Regras de acesso (RLS) de todas as coleções.

   Antes: todas as regras vazias = público. Qualquer pessoa com o endereço
   lia e escrevia. Agora:
     - gestor  -> vê e altera tudo;
     - tecnico -> só as obras em que está em `obras.tecnicos`;
     - ninguém sem login.

   A regra vale no servidor: esconder botão na tela não é permissão. */
migrate(
  (app) => {
    const gestor = '@request.auth.perfil = "gestor"'
    const logado = '@request.auth.id != ""'
    const daObra = 'obra.tecnicos ?= @request.auth.id'
    const veObra = logado + ' && (' + gestor + ' || ' + daObra + ')'

    // ---------- obras ----------
    const obras = app.findCollectionByNameOrId('obras')
    obras.listRule = logado + ' && (' + gestor + ' || tecnicos ?= @request.auth.id)'
    obras.viewRule = obras.listRule
    obras.createRule = gestor
    obras.updateRule = gestor
    obras.deleteRule = gestor
    app.save(obras)

    // ---------- ambientes, itens, relatorios: herdam a obra ----------
    const ambientes = app.findCollectionByNameOrId('ambientes')
    ambientes.listRule = veObra
    ambientes.viewRule = veObra
    ambientes.createRule = gestor
    ambientes.updateRule = veObra
    ambientes.deleteRule = gestor
    app.save(ambientes)

    const itens = app.findCollectionByNameOrId('itens')
    itens.listRule = veObra
    itens.viewRule = veObra
    itens.createRule = gestor
    itens.updateRule = veObra
    itens.deleteRule = gestor
    app.save(itens)

    const relatorios = app.findCollectionByNameOrId('relatorios')
    relatorios.listRule = veObra
    relatorios.viewRule = veObra
    relatorios.createRule = veObra
    relatorios.updateRule = veObra
    relatorios.deleteRule = gestor
    app.save(relatorios)

    // ---------- ordens ----------
    const ordens = app.findCollectionByNameOrId('ordens')
    ordens.listRule = veObra
    ordens.viewRule = veObra
    ordens.createRule = gestor
    ordens.updateRule = veObra
    ordens.deleteRule = gestor
    app.save(ordens)

    // ---------- modelos de checklist ----------
    const modelos = app.findCollectionByNameOrId('modelos')
    modelos.listRule = logado
    modelos.viewRule = logado
    modelos.createRule = gestor
    modelos.updateRule = gestor
    modelos.deleteRule = gestor
    app.save(modelos)

    // ---------- orcamentos: dinheiro não aparece para tecnico ----------
    const orcamentos = app.findCollectionByNameOrId('orcamentos')
    orcamentos.listRule = gestor
    orcamentos.viewRule = gestor
    orcamentos.createRule = gestor
    orcamentos.updateRule = gestor
    orcamentos.deleteRule = gestor
    app.save(orcamentos)

    // ---------- users ----------
    const users = app.findCollectionByNameOrId('users')
    users.listRule = logado + ' && (' + gestor + ' || id = @request.auth.id)'
    users.viewRule = users.listRule
    users.createRule = gestor
    // ninguém troca o próprio perfil pela API: perfil só muda por rota do gestor
    users.updateRule =
      logado +
      ' && (id = @request.auth.id || ' +
      gestor +
      ') && @request.body.perfil:changed = false'
    users.deleteRule = gestor + ' && id != @request.auth.id'
    app.save(users)
  },
  (app) => {
    // volta ao estado anterior: público (só para permitir o rollback em teste)
    const nomes = [
      'obras',
      'ambientes',
      'itens',
      'relatorios',
      'ordens',
      'modelos',
      'orcamentos',
      'users',
    ]
    for (let i = 0; i < nomes.length; i++) {
      const col = app.findCollectionByNameOrId(nomes[i])
      col.listRule = ''
      col.viewRule = ''
      col.createRule = ''
      col.updateRule = ''
      col.deleteRule = ''
      app.save(col)
    }
  },
)
