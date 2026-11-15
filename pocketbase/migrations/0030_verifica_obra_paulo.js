/* Conferência de integridade da obra do Paulo.

   Não altera nada: só LÊ e LANÇA ERRO se o dado estiver errado. Se este
   deploy passar, o valor está gravado como tem de estar. É o teste que
   substitui "confiar que a migration rodou".

   Confere, para a obra "Paulo — Arujazinho 5":
   - existem 2 recebimentos, somando R$ 6.300,00
   - o equipamento HC3 tem valor_compra = 0 (não é custo da AxiomTec)
   - o endereço está completo e o telefone gravado no cliente
   - a obra tem um responsável em `tecnicos`
   - a margem calculada é R$ 6.300,00, não R$ 1.300 */
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
    if (!obra) {
      throw new Error('VERIFICACAO: obra "' + OBRA + '" não encontrada')
    }

    // 1. recebimentos
    const receb = app.findRecordsByFilter('recebimentos', 'obra = {:o}', '', 500, 0, {
      o: obra.id,
    })
    let somaReceb = 0
    for (let i = 0; i < receb.length; i++) somaReceb += receb[i].getFloat('valor') || 0
    if (receb.length !== 2) {
      problemas.push('esperava 2 recebimentos, achou ' + receb.length)
    }
    if (Math.abs(somaReceb - 6300) > 0.01) {
      problemas.push('recebimentos somam ' + somaReceb + ', esperado 6300')
    }

    // 2. equipamento sem custo
    const equips = app.findRecordsByFilter('equipamentos', 'obra = {:o}', '', 500, 0, {
      o: obra.id,
    })
    let custoEquip = 0
    for (let i = 0; i < equips.length; i++) custoEquip += equips[i].getFloat('valor_compra') || 0
    if (Math.abs(custoEquip) > 0.01) {
      problemas.push('custo de equipamento deveria ser 0, está ' + custoEquip)
    }

    // 3. orçamentos e margem
    const orcs = app.findRecordsByFilter('orcamentos', 'obra = {:o}', '', 500, 0, {
      o: obra.id,
    })
    let somaOrc = 0
    for (let i = 0; i < orcs.length; i++) somaOrc += orcs[i].getFloat('valor') || 0
    const despesas = app.findRecordsByFilter('despesas', 'obra = {:o}', '', 500, 0, {
      o: obra.id,
    })
    let somaDesp = 0
    for (let i = 0; i < despesas.length; i++) {
      const st = String(despesas[i].getString('status') || '')
      if (st === 'aprovado' || st === 'reembolsado') somaDesp += despesas[i].getFloat('valor') || 0
    }
    const margem = somaOrc - custoEquip - somaDesp
    if (Math.abs(margem - 6300) > 0.01) {
      problemas.push('margem deveria ser 6300, calculou ' + margem)
    }
    if (Math.abs(margem - 1300) < 0.01) {
      problemas.push('margem saiu como 1300 — a HC3 entrou como custo por engano')
    }

    // 4. endereço, telefone e responsável
    const endereco = String(obra.getString('endereco') || '')
    if (endereco.indexOf('Água Marinha') === -1) {
      problemas.push('endereço da obra incompleto: "' + endereco + '"')
    }
    let cliente = null
    try {
      cliente = app.findFirstRecordByData('clientes', 'nome', 'Paulo Boscatto')
    } catch (_) {
      cliente = null
    }
    if (!cliente) {
      problemas.push('cliente "Paulo Boscatto" não encontrado')
    } else if (String(cliente.getString('telefone') || '').indexOf('98162') === -1) {
      problemas.push('telefone do cliente não gravado')
    }
    if (!String(obra.getString('tecnicos') || '')) {
      problemas.push('obra sem responsável em tecnicos')
    }

    if (problemas.length > 0) {
      throw new Error('VERIFICACAO FALHOU: ' + problemas.join(' | '))
    }
  },
  () => {
    /* nada a desfazer: esta migration não escreve */
  },
)
