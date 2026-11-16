/* Trocar a própria senha: exige a senha atual e grava a nova.

   A senha atual é validada de verdade no servidor com validatePassword
   (a regra da coleção aceitaria o update direto sem conferir nada) e a
   nova senha só grava se bater. O token do chamador continua válido
   depois da troca — o PocketBase não revoga por padrão. */
routerAdd(
  'POST',
  '/backend/v1/acesso/trocar-senha',
  (e) => {
    const auth = e.auth
    if (!auth) {
      throw new ForbiddenError('Faça login para trocar a senha.')
    }

    const body = e.requestInfo().body || {}
    const senhaAtual = String(body.senha_atual || '')
    const novaSenha = String(body.nova_senha || '')

    if (!senhaAtual) {
      throw new BadRequestError('Informe a senha atual.')
    }
    if (novaSenha.length < 8) {
      throw new BadRequestError('A nova senha precisa de pelo menos 8 caracteres.')
    }

    if (!auth.validatePassword(senhaAtual)) {
      throw new BadRequestError('A senha atual não confere.')
    }

    auth.setPassword(novaSenha)
    $app.save(auth)

    return e.json(200, { ok: true, email: auth.getString('email') })
  },
  $apis.requireAuth(),
)
