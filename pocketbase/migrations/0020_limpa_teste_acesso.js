/* Limpa as contas de teste do fluxo de acesso.

   Deixa o sistema em zero usuário de novo, para o Rossini criar a conta dele
   na tela de primeiro acesso. Antes de apagar os usuários, esvazia
   `obras.tecnicos`: a relação não tem cascadeDelete, e um id órfão ficaria
   apontando para um usuário que não existe mais.

   Só toca em e-mail @teste.local. Em produção não há nenhum — é no-op. */
migrate(
  (app) => {
    const usuarios = app.findRecordsByFilter('users', 'email ~ "@teste.local"', '', 100, 0)
    if (usuarios.length === 0) return

    const ids = []
    for (let i = 0; i < usuarios.length; i++) ids.push(usuarios[i].id)

    // tira esses ids de qualquer obra antes de apagar os usuários
    const obras = app.findRecordsByFilter('obras', '', '', 500, 0)
    for (let i = 0; i < obras.length; i++) {
      const obra = obras[i]
      const atuais = obra.getStringSlice('tecnicos')
      const restantes = []
      let mudou = false
      for (let k = 0; k < atuais.length; k++) {
        if (ids.indexOf(atuais[k]) < 0) {
          restantes.push(atuais[k])
        } else {
          mudou = true
        }
      }
      if (mudou) {
        obra.set('tecnicos', restantes)
        app.save(obra)
      }
    }

    for (let i = 0; i < usuarios.length; i++) {
      app.delete(usuarios[i])
    }
  },
  () => {
    /* nada a reverter: apagar conta de teste não precisa de volta */
  },
)
