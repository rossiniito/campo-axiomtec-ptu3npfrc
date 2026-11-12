/* Correção de permissão na despesa de campo.

   A regra da 0022 deixava o técnico lançar despesa em QUALQUER obra, bastando
   mandar o id. Isso é falha de regra no servidor, não detalhe de tela: ele
   poderia inflar o custo da obra de um colega e derrubar a margem dela.

   Agora: técnico só lança em obra onde está alocado, e sempre em nome próprio. */
migrate(
  (app) => {
    const despesas = app.findCollectionByNameOrId('despesas')
    despesas.createRule =
      '@request.auth.id != "" && tecnico = @request.auth.id && (@request.auth.perfil = "gestor" || obra.tecnicos ~ @request.auth.id)'
    app.save(despesas)
  },
  (app) => {
    const despesas = app.findCollectionByNameOrId('despesas')
    despesas.createRule = '@request.auth.id != "" && tecnico = @request.auth.id'
    app.save(despesas)
  },
)
