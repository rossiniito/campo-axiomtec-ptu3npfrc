// Registra de onde veio o checklist da OS e se ele já foi criado no ClickUp.
// Sem esse controle o app recriaria o checklist a cada sincronização e a
// tarefa ficaria com vários checklists duplicados.
migrate(
  (app) => {
    const ordens = app.findCollectionByNameOrId('ordens')
    if (!ordens.fields.getByName('modelo')) {
      ordens.fields.add(
        new RelationField({
          name: 'modelo',
          required: false,
          collectionId: app.findCollectionByNameOrId('modelos').id,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
    }
    if (!ordens.fields.getByName('checklist_criado_clickup_em')) {
      ordens.fields.add(new DateField({ name: 'checklist_criado_clickup_em' }))
    }
    app.save(ordens)
  },
  (app) => {
    const ordens = app.findCollectionByNameOrId('ordens')
    ordens.fields.removeByName('modelo')
    ordens.fields.removeByName('checklist_criado_clickup_em')
    app.save(ordens)
  },
)
