/* Diz se o sistema já tem o primeiro usuário — a tela de login usa isso
   para mostrar "configurar acesso" em vez de "entrar". Rota pública, mas
   não devolve nada além de um booleano. */
routerAdd('GET', '/backend/v1/acesso/status', (e) => {
  const existentes = $app.findRecordsByFilter('users', '', '', 1, 0)
  return e.json(200, { configurado: existentes.length > 0 })
})
