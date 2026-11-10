/* Arquivos protegidos: foto de dentro da casa do cliente e assinatura não
   podem ser baixadas sem login. Sem isso o endereço do arquivo vale como
   senha, e um link vazado entrega a foto. */
migrate(
  (app) => {
    const itens = app.findCollectionByNameOrId('itens')
    const foto = itens.fields.getByName('foto')
    if (foto) {
      foto.protected = true
      app.save(itens)
    }

    const relatorios = app.findCollectionByNameOrId('relatorios')
    const assinaturaCliente = relatorios.fields.getByName('assinatura_cliente')
    const assinaturaTecnico = relatorios.fields.getByName('assinatura_tecnico')
    if (assinaturaCliente) assinaturaCliente.protected = true
    if (assinaturaTecnico) assinaturaTecnico.protected = true
    app.save(relatorios)
  },
  (app) => {
    const itens = app.findCollectionByNameOrId('itens')
    const foto = itens.fields.getByName('foto')
    if (foto) {
      foto.protected = false
      app.save(itens)
    }

    const relatorios = app.findCollectionByNameOrId('relatorios')
    const assinaturaCliente = relatorios.fields.getByName('assinatura_cliente')
    const assinaturaTecnico = relatorios.fields.getByName('assinatura_tecnico')
    if (assinaturaCliente) assinaturaCliente.protected = false
    if (assinaturaTecnico) assinaturaTecnico.protected = false
    app.save(relatorios)
  },
)
