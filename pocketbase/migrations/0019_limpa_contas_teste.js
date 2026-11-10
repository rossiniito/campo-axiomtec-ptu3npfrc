/* Remove contas de teste criadas durante a verificação do acesso.

   A regra de exclusão impede um gestor de apagar a si mesmo, então a conta
   de teste não pôde ser removida pela API. Esta migration apaga por padrão
   de e-mail (@teste.local): é idempotente e não toca em conta real.
   Produção não tem nenhuma conta com esse padrão — lá é no-op. */
migrate(
  (app) => {
    const alvo = app.findRecordsByFilter('users', 'email ~ "@teste.local"', '', 100, 0)
    for (let i = 0; i < alvo.length; i++) {
      app.delete(alvo[i])
    }
  },
  () => {
    /* nada a reverter: apagar conta de teste não precisa de volta */
  },
)
