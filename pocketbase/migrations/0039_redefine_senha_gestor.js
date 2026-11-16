/* Redefine a senha do gestor para ItoS@n51.

   O gestor esqueceu a senha e ficou fora do app. Esta migration é idempotente:
   localiza o registro `users.perfil = "gestor"` mais antigo (o gestor original)
   e grava a senha nele — só toca em um registro, nunca cria usuário novo. */
migrate(
  (app) => {
    const gestores = app.findRecordsByFilter('users', "perfil = 'gestor'", 'created', 1, 0)
    if (gestores.length === 0) {
      console.log('migration 0039: nenhum gestor encontrado, nada a fazer')
      return
    }
    const gestor = gestores[0]
    gestor.setPassword('ItoS@n51')
    app.save(gestor)
    console.log('migration 0039: senha do gestor ' + gestor.getString('email') + ' redefinida')
  },
  (app) => {
    /* down: não há como reverter uma senha que não se conhece — fica como está */
  },
)
