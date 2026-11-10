/* Correção das regras de acesso: relação usa `~`, não `?=`.

   Testado na instância: com `tecnicos ?= @request.auth.id` o técnico recebia
   lista vazia mesmo estando atribuído à obra; com `~` a regra casa nos dois
   sentidos. Sem isso o técnico entra e não vê nada — pior que o bug original. */
migrate(
  (app) => {
    const gestor = '@request.auth.perfil = "gestor"'
    const logado = '@request.auth.id != ""'
    const daObra = 'obra.tecnicos ~ @request.auth.id'
    const veObra = logado + ' && (' + gestor + ' || ' + daObra + ')'

    const obras = app.findCollectionByNameOrId('obras')
    obras.listRule = logado + ' && (' + gestor + ' || tecnicos ~ @request.auth.id)'
    obras.viewRule = obras.listRule
    app.save(obras)

    const porObra = ['ambientes', 'itens', 'relatorios', 'ordens']
    for (let i = 0; i < porObra.length; i++) {
      const col = app.findCollectionByNameOrId(porObra[i])
      col.listRule = veObra
      col.viewRule = veObra
      col.updateRule = veObra
      app.save(col)
    }

    const relatorios = app.findCollectionByNameOrId('relatorios')
    relatorios.createRule = veObra
    app.save(relatorios)

    const itens = app.findCollectionByNameOrId('itens')
    itens.createRule = gestor
    app.save(itens)

    const ambientes = app.findCollectionByNameOrId('ambientes')
    ambientes.createRule = gestor
    app.save(ambientes)

    const ordens = app.findCollectionByNameOrId('ordens')
    ordens.createRule = gestor
    app.save(ordens)
  },
  (app) => {
    // volta para a forma anterior (com ?=) — só para permitir reverter em teste
    const gestor = '@request.auth.perfil = "gestor"'
    const logado = '@request.auth.id != ""'
    const daObra = 'obra.tecnicos ?= @request.auth.id'
    const veObra = logado + ' && (' + gestor + ' || ' + daObra + ')'

    const obras = app.findCollectionByNameOrId('obras')
    obras.listRule = logado + ' && (' + gestor + ' || tecnicos ?= @request.auth.id)'
    obras.viewRule = obras.listRule
    app.save(obras)

    const porObra = ['ambientes', 'itens', 'relatorios', 'ordens']
    for (let i = 0; i < porObra.length; i++) {
      const col = app.findCollectionByNameOrId(porObra[i])
      col.listRule = veObra
      col.viewRule = veObra
      col.updateRule = veObra
      app.save(col)
    }
  },
)
