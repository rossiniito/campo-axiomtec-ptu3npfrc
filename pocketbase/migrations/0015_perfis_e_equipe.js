/* Perfis de acesso e equipe.

   - users.perfil: 'gestor' (vê tudo) ou 'tecnico' (vê só a obra dele).
   - obras.tecnicos: quais técnicos respondem por aquela obra.

   Sem isso não há como aplicar a regra "o técnico só vê a obra dele",
   porque hoje a obra não guarda ninguém. */
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    if (!users.fields.getByName('perfil')) {
      users.fields.add(
        new SelectField({
          name: 'perfil',
          values: ['gestor', 'tecnico'],
          maxSelect: 1,
        }),
      )
    }
    app.save(users)

    const obras = app.findCollectionByNameOrId('obras')
    if (!obras.fields.getByName('tecnicos')) {
      obras.fields.add(
        new RelationField({
          name: 'tecnicos',
          collectionId: '_pb_users_auth_',
          maxSelect: 10,
          minSelect: 0,
          cascadeDelete: false,
        }),
      )
    }
    app.save(obras)
  },
  (app) => {
    const obras = app.findCollectionByNameOrId('obras')
    obras.fields.removeByName('tecnicos')
    app.save(obras)

    const users = app.findCollectionByNameOrId('users')
    users.fields.removeByName('perfil')
    app.save(users)
  },
)
