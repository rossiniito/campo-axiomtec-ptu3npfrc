/* Cria um usuário novo. Só o gestor pode.

   Existe como rota própria para definir a senha com `setPassword` (que
   gera o hash) e devolver um erro legível, em vez do 400 genérico da API. */
routerAdd(
  'POST',
  '/backend/v1/acesso/criar-usuario',
  (e) => {
    const auth = e.auth
    if (!auth || String(auth.get('perfil')) !== 'gestor') {
      throw new ForbiddenError('Só o gestor pode cadastrar usuários.')
    }

    const body = e.requestInfo().body || {}
    const email = String(body.email || '')
      .trim()
      .toLowerCase()
    const nome = String(body.nome || '').trim()
    const senha = String(body.password || '')
    const perfil = String(body.perfil || 'tecnico')

    if (!email || email.indexOf('@') < 0) {
      throw new BadRequestError('Informe um e-mail válido.')
    }
    if (senha.length < 8) {
      throw new BadRequestError('A senha precisa de pelo menos 8 caracteres.')
    }
    if (perfil !== 'gestor' && perfil !== 'tecnico') {
      throw new BadRequestError('Perfil inválido: use gestor ou tecnico.')
    }

    const registro = new Record($app.findCollectionByNameOrId('users'))
    registro.setEmail(email)
    registro.setPassword(senha)
    registro.set('name', nome || email)
    registro.set('perfil', perfil)
    registro.setVerified(true)
    $app.save(registro)

    return e.json(201, { id: registro.id, email: email, nome: nome, perfil: perfil })
  },
  $apis.requireAuth(),
)
