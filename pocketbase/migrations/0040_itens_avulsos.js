// Itens avulsos de OS: campos que marcam a tarefa criada manualmente
// na tela de execução (ChecklistObra), sem tocar nos modelos globais.
// Nenhuma coleção nova: reusa "itens" (obra/ambiente/nome/foto/ordem),
// então o item nasce com todas as capacidades — marcar, observação, fotos,
// progresso e relatório — e a API rule de update do técnico já vale.
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('itens')

    if (!col.fields.getByName('avulso')) {
      col.fields.add(new BoolField({ name: 'avulso' }))
    }

    if (!col.fields.getByName('criado_por')) {
      col.fields.add(
        new RelationField({
          name: 'criado_por',
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
        }),
      )
    }

    // Se a obra tiver um modelo vinculado, o relatório cita a fonte; o item
    // avulso não tem modelo, então guarda o nome do modelo no momento do uso.
    if (!col.fields.getByName('modelo')) {
      col.fields.add(
        new RelationField({
          name: 'modelo',
          collectionId: app.findCollectionByNameOrId('modelos').id,
          maxSelect: 1,
        }),
      )
    }

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('itens')
    ;['avulso', 'criado_por', 'modelo'].forEach((nome) => {
      const f = col.fields.getByName(nome)
      if (f) col.fields.removeByName(nome)
    })
    app.save(col)
  },
)
