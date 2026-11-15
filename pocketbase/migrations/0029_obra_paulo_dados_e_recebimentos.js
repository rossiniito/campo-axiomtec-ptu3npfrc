/* Completa a obra do Paulo com os dados que faltavam (informados em 15/11/2026):
   endereço completo, telefone, responsável e as duas fontes de dinheiro.

   DINHEIRO — duas entradas de origens diferentes, no mesmo dia:
   1) R$ 3.000,00 — serviço, pago pelo Paulo na conclusão (18/11/2026), conta BTG PJ
   2) R$ 3.300,00 — comissão da HC3, paga pelo fornecedor Eder, conta Nubank PJ

   A comissão NÃO vem do cliente: é receita da AxiomTec, mas de outro pagador.
   Por isso ela fica como recebimento da obra com a origem escrita na descrição,
   em vez de virar um segundo orçamento — o orçamento já existe desde a 0028.

   ATENÇÃO ao padrão 40/30/30: aqui NÃO se aplica. É pagamento único no fim.
   Isso é seguro apenas porque o cliente comprou a HC3 direto do fornecedor:
   a AxiomTec não desembolsa equipamento. O risco que sobra é de mão de obra —
   R$ 3.000 entregues antes de receber. */
const OBRA = 'Paulo — Arujazinho 5'
const CLIENTE = 'Paulo'
const ENDERECO = 'Av. Água Marinha, 579 — Arujazinho 5 — Arujá (SP)'
const TELEFONE = '11 98162-6977'
const VENC = '2026-11-18 12:00:00.000Z'

migrate(
  (app) => {
    // ---- 1. cliente: telefone e endereço completo ----
    let cliente = null
    try {
      cliente = app.findFirstRecordByData('clientes', 'nome', CLIENTE)
    } catch (_) {
      cliente = null
    }
    if (cliente) {
      cliente.set('nome', 'Paulo Boscatto')
      cliente.set('telefone', TELEFONE)
      cliente.set('endereco', ENDERECO)
      cliente.set(
        'observacoes',
        'Dados completos informados pelo Rossini em 15/11/2026. Pagamento do serviço na conclusão, pela conta BTG PJ da AxiomTec.',
      )
      app.save(cliente)
    }

    // ---- 2. obra: endereço completo e responsável ----
    let obra = null
    try {
      obra = app.findFirstRecordByData('obras', 'nome', OBRA)
    } catch (_) {
      obra = null
    }
    if (!obra) return

    obra.set('endereco', ENDERECO)

    // Responsável informado: Rossini Ito. Pego o gestor do banco em vez de
    // gravar id na mão — assim não quebra se a conta for recriada.
    let gestorId = ''
    try {
      const gestores = app.findRecordsByFilter('users', 'perfil = "gestor"', '', 1, 0)
      if (gestores.length > 0) gestorId = gestores[0].id
    } catch (_) {
      gestorId = ''
    }
    if (gestorId && !String(obra.getString('tecnicos') || '')) {
      obra.set('tecnicos', [gestorId])
    }
    app.save(obra)

    // OS: marca o responsável e registra a data prevista de execução.
    try {
      const ordens = app.findRecordsByFilter('ordens', 'obra = {:o}', '', 5, 0, { o: obra.id })
      for (let i = 0; i < ordens.length; i++) {
        const os = ordens[i]
        // Em `ordens`, o campo `tecnico` é TEXTO (herança do ClickUp), não
        // relação: gravar o id deixaria ilegível na tela. O acesso do técnico
        // é controlado por `obras.tecnicos`, que é relação. Aqui vai o nome.
        os.set('tecnico', 'Rossini Ito')
        os.set('data_prevista', VENC)
        app.save(os)
      }
    } catch (_) {
      /* coleção de ordens pode não ter data_prevista; segue */
    }

    // ---- 3. recebimentos ----
    // Idempotente por descrição: rodar de novo não duplica.
    const criar = (descricao, valor) => {
      let jaTem = []
      try {
        jaTem = app.findRecordsByFilter(
          'recebimentos',
          'obra = {:o} && descricao = {:d}',
          '',
          1,
          0,
          { o: obra.id, d: descricao },
        )
      } catch (_) {
        jaTem = []
      }
      if (jaTem.length > 0) return null

      const r = new Record(app.findCollectionByNameOrId('recebimentos'))
      r.set('obra', obra.id)
      r.set('tipo', 'parcela')
      r.set('descricao', descricao)
      r.set('percentual', valor === 3000 ? 100 : 0)
      r.set('valor', valor)
      r.set('vencimento', VENC)
      r.set('status', 'a_receber')
      app.save(r)
      return r
    }

    criar(
      'Serviço — troca HC2 por HC3 e reconfiguração Z-Wave (pago pelo Paulo, conta BTG PJ)',
      3000,
    )
    criar('Comissão HC3 (paga pelo fornecedor Eder, conta Nubank PJ)', 3300)

    // ---- 4. verificação gravada no log ----
    // Soma o que ficou no banco para esta obra. Se não fechar 6.300, o log denuncia.
    try {
      const todos = app.findRecordsByFilter('recebimentos', 'obra = {:o}', '', 500, 0, {
        o: obra.id,
      })
      let soma = 0
      for (let i = 0; i < todos.length; i++) soma += todos[i].getFloat('valor') || 0
      const log = app.logger()
      log.info(
        'recebimentos da obra do Paulo conferidos',
        'quantidade',
        todos.length,
        'soma',
        soma,
        'esperado',
        6300,
        'bate',
        Math.abs(soma - 6300) < 0.01,
      )
    } catch (err) {
      /* sem logger, a migration já gravou o que tinha de gravar */
    }
  },
  (app) => {
    try {
      const obras = app.findRecordsByFilter('obras', 'nome = {:n}', '', 5, 0, { n: OBRA })
      for (let i = 0; i < obras.length; i++) {
        const recs = app.findRecordsByFilter('recebimentos', 'obra = {:o}', '', 500, 0, {
          o: obras[i].id,
        })
        for (let k = 0; k < recs.length; k++) app.delete(recs[k])
        obras[i].set('endereco', 'Condomínio Arujazinho 5 — Arujá (SP)')
        obras[i].set('tecnicos', [])
        app.save(obras[i])
      }
    } catch (_) {
      /* nada a reverter */
    }
  },
)
