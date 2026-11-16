/* Tarefa avulsa na execução da OS: gestor E técnico podem criar itens
   na obra em que estão escalados (a tela + Adicionar tarefa).

   Regra: criador precisa estar logado e estar na equipe da obra
   (o gestor passa pela primeira condição do OU, pois perfil = gestor
   dá acesso a tudo). O app só oferece criação pela tela de execução,
   que sempre grava avulso = true. */
migrate(
  (app) => {
    const itens = app.findCollectionByNameOrId('itens')
    itens.createRule =
      '@request.auth.id != "" && ' +
      '(@request.auth.perfil = "gestor" || obra.tecnicos ~ @request.auth.id)'
    app.save(itens)
  },
  (app) => {
    const itens = app.findCollectionByNameOrId('itens')
    itens.createRule = '@request.auth.perfil = "gestor"'
    app.save(itens)
  },
)
