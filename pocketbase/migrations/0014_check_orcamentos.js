// Quando o orçamento é aprovado, o sistema cria a obra e a primeira OS sozinho
// — o equivalente da automação que hoje o ClickUp faz por você.
migrate(
  (app) => {
    // nada estrutural: só garante que a coleção existe antes do hook usar
    app.findCollectionByNameOrId('orcamentos')
    app.findCollectionByNameOrId('ordens')
  },
  (app) => {
    // reversível: não apaga dados
  },
)
