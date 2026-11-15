/* Conserta e confere a obra do Paulo.

   Histórico do erro: a 0029 foi aplicada na primeira tentativa, quando ela
   ainda procurava o gestor por `perfil = "gestor"`. Se a conta do Rossini
   estiver com perfil vazio, o filtro devolvia nada e `tecnicos` ficou vazio —
   em silêncio. Como a 0029 já está marcada como aplicada, ela não roda de
   novo; por isso a correção vive aqui.

   Esta migration:
   1. acha a conta do responsável sem depender de `perfil`
   2. grava em obras.tecnicos e confirma relendo do banco
   3. confere recebimentos (2 × R$ 6.300), custo 0 da HC3 e margem de R$ 6.300
   Se qualquer passo falhar, lança erro com o diagnóstico junto. */
migrate(
  (app) => {
    const OBRA = 'Paulo — Arujazinho 5'
    const problemas = []

    let obra = null
    try {
      obra = app.findFirstRecordByData('obras', 'nome', OBRA)
    } catch (_) {
      obra = null
    }
    if (!obra) throw new Error('VERIFICACAO: obra "' + OBRA + '" não encontrada')

    // ---- 1. responsável: sem filtrar por perfil ----
    let gestorId = ''
    let diagnostico = 'nenhum usuário'
    const usuarios = app.findRecordsByFilter('users', '', '', 50, 0)
    diagnostico = 'users=' + usuarios.length
    for (let i = 0; i < usuarios.length; i++) {
      const perfil = String(usuarios[i].getString('perfil') || '')
      diagnostico += ' [' + (usuarios[i].getString('email') || '?') + ':' + perfil + ']'
      if (perfil === 'gestor' && !gestorId) gestorId = usuarios[i].id
    }
    if (!gestorId && usuarios.length > 0) gestorId = usuarios[0].id

    if (!gestorId) {
      throw new Error('SEM CONTA PARA RESPONSAVEL | ' + diagnostico)
    }

    obra.set('tecnicos', [gestorId])
    app.save(obra)

    const relido = app.findRecordById('obras', obra.id)
    // Relação múltipla não se lê com getString de forma confiável: uso
    // getStringSlice, que é o acessor certo para relação maxSelect > 1.
    let idsGravados = []
    try {
      idsGravados = relido.getStringSlice('tecnicos') || []
    } catch (_) {
      idsGravados = []
    }
    let achou = false
    for (let i = 0; i < idsGravados.length; i++) {
      if (idsGravados[i] === gestorId) achou = true
    }
    if (!achou) {
      problemas.push(
        'responsável não gravou: campo tem [' + idsGravados.join(',') + '] | ' + diagnostico,
      )
    }

    // ---- 2. recebimentos ----
    const receb = app.findRecordsByFilter('recebimentos', 'obra = {:o}', '', 500, 0, {
      o: obra.id,
    })
    let somaReceb = 0
    for (let i = 0; i < receb.length; i++) somaReceb += receb[i].getFloat('valor') || 0
    if (receb.length !== 2) problemas.push('esperava 2 recebimentos, achou ' + receb.length)
    if (Math.abs(somaReceb - 6300) > 0.01) {
      problemas.push('recebimentos somam ' + somaReceb + ', esperado 6300')
    }

    // ---- 3. equipamento sem custo + margem ----
    const equips = app.findRecordsByFilter('equipamentos', 'obra = {:o}', '', 500, 0, {
      o: obra.id,
    })
    let custoEquip = 0
    for (let i = 0; i < equips.length; i++) custoEquip += equips[i].getFloat('valor_compra') || 0
    if (Math.abs(custoEquip) > 0.01) {
      problemas.push('custo de equipamento deveria ser 0, está ' + custoEquip)
    }

    const orcs = app.findRecordsByFilter('orcamentos', 'obra = {:o}', '', 500, 0, { o: obra.id })
    let somaOrc = 0
    for (let i = 0; i < orcs.length; i++) somaOrc += orcs[i].getFloat('valor') || 0

    const despesas = app.findRecordsByFilter('despesas', 'obra = {:o}', '', 500, 0, { o: obra.id })
    let somaDesp = 0
    for (let i = 0; i < despesas.length; i++) {
      const st = String(despesas[i].getString('status') || '')
      if (st === 'aprovado' || st === 'reembolsado') somaDesp += despesas[i].getFloat('valor') || 0
    }
    const margem = somaOrc - custoEquip - somaDesp
    if (Math.abs(margem - 6300) > 0.01) {
      problemas.push('margem deveria ser 6300, calculou ' + margem)
    }

    // ---- 4. endereço e telefone ----
    if (String(obra.getString('endereco') || '').indexOf('Água Marinha') === -1) {
      problemas.push('endereço da obra incompleto')
    }
    let cliente = null
    try {
      cliente = app.findFirstRecordByData('clientes', 'nome', 'Paulo Boscatto')
    } catch (_) {
      cliente = null
    }
    if (!cliente) problemas.push('cliente "Paulo Boscatto" não encontrado')
    else if (String(cliente.getString('telefone') || '').indexOf('98162') === -1) {
      problemas.push('telefone do cliente não gravado')
    }

    if (problemas.length > 0) {
      throw new Error('VERIFICACAO FALHOU: ' + problemas.join(' | '))
    }
  },
  (app) => {
    /* não desfaz nada: só corrige o vínculo e confere */
  },
)
