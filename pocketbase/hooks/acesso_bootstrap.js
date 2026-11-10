/* Primeiro acesso: cria o gestor quando ainda não existe nenhum usuário.

   Sem isso o sistema ficaria trancado para sempre: a criação de usuário é
   exclusiva do gestor, e no dia zero não há gestor. A rota só funciona
   enquanto a coleção de usuários está vazia — depois disso responde 409. */
routerAdd('POST', '/backend/v1/acesso/bootstrap', (e) => {
  const body = e.requestInfo().body || {}
  const email = String(body.email || '')
    .trim()
    .toLowerCase()
  const senha = String(body.password || '')
  const nome = String(body.nome || '').trim()

  if (!email || email.indexOf('@') < 0) {
    return e.json(400, { error: 'Informe um e-mail válido.' })
  }
  if (senha.length < 8) {
    return e.json(400, { error: 'A senha precisa de pelo menos 8 caracteres.' })
  }

  // já existindo qualquer usuário, este caminho está fechado
  const existentes = $app.findRecordsByFilter('users', '', '', 1, 0)
  if (existentes.length > 0) {
    return e.json(409, { error: 'O sistema já está configurado. Faça login.' })
  }

  const registro = new Record($app.findCollectionByNameOrId('users'))
  registro.setEmail(email)
  registro.setPassword(senha)
  registro.set('name', nome || 'Gestor')
  registro.set('perfil', 'gestor')
  registro.setVerified(true)
  $app.save(registro)

  return e.json(201, { ok: true, email: email })
})
