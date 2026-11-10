/* Define quem é responsável por uma obra.

   O gestor escolhe os técnicos; `obras.tecnicos` é o que decide o que cada
   um enxerga (a regra de acesso lê esse campo). O técnico não pode se
   atribuir a uma obra nem mexer na equipe de outra pessoa. */
routerAdd(
  'POST',
  '/backend/v1/obras/equipe',
  (e) => {
    const auth = e.auth
    if (!auth || String(auth.get('perfil')) !== 'gestor') {
      throw new ForbiddenError('Só o gestor define a equipe da obra.')
    }

    const body = e.requestInfo().body || {}
    const obraId = String(body.obra_id || '').trim()
    const tecnicos = Array.isArray(body.tecnicos) ? body.tecnicos : []

    if (!obraId) throw new BadRequestError('Informe a obra (obra_id).')

    let obra
    try {
      obra = $app.findRecordById('obras', obraId)
    } catch (_) {
      throw new NotFoundError('Obra não encontrada.')
    }

    // confere que cada id é de um técnico de verdade
    for (let i = 0; i < tecnicos.length; i++) {
      let usuario
      try {
        usuario = $app.findRecordById('users', String(tecnicos[i]))
      } catch (_) {
        throw new BadRequestError('Técnico não encontrado: ' + String(tecnicos[i]))
      }
      if (String(usuario.get('perfil')) !== 'tecnico') {
        throw new BadRequestError(
          'O usuário ' + String(usuario.get('name') || usuario.get('email')) + ' não é técnico.',
        )
      }
    }

    obra.set('tecnicos', tecnicos)
    $app.save(obra)

    return e.json(200, { obra: obra.id, tecnicos: tecnicos })
  },
  $apis.requireAuth(),
)
