/* Serviço do Paulo — Condomínio Arujazinho 5, Arujá (SP).

   Troca da central Fibaro HC2 pela HC3 + reconfiguração de todo o sistema
   Z-Wave do cliente. Dados trazidos pelo Rossini em 15/11/2026.

   DINHEIRO — a distinção é o ponto crítico deste registro:
   - Mão de obra cobrada do cliente ....... R$ 3.000,00  (entra na AxiomTec)
   - Comissão sobre a central HC3 ......... R$ 3.300,00  (entra na AxiomTec,
     paga pelo fornecedor; o cliente pagou R$ 8.300 direto a ele)
   - Central HC3 .......................... R$ 5.000,00  (NÃO passa pelo
     caixa da AxiomTec, não é custo da obra)
   Receita total da AxiomTec: R$ 6.300,00.

   Por isso são registrados DOIS orçamentos (serviço e comissão) e o
   equipamento HC3 entra com valor_compra = 0: se entrasse com 5.000, a
   margem da obra (orçamentos − equipamentos − despesas) mostraria R$ 1.300
   de lucro, o que é falso.

   Datas e responsáveis não foram informados: não são inventados aqui.
   Por isso nenhum recebimento é gerado — falta vencimento e condição de
   pagamento para montar o cronograma sem chutar. */
const CLIENTE = 'Paulo'
const OBRA = 'Paulo — Arujazinho 5'
const ENDERECO = 'Condomínio Arujazinho 5 — Arujá (SP)'

migrate(
  (app) => {
    // ---- 1. cliente ----------------------------------------------------
    let cliente
    try {
      cliente = app.findFirstRecordByData('clientes', 'nome', CLIENTE)
    } catch (_) {
      cliente = new Record(app.findCollectionByNameOrId('clientes'))
      cliente.set('nome', CLIENTE)
      cliente.set('tipo', 'residencial')
      cliente.set('endereco', ENDERECO)
      cliente.set('ativo', true)
      cliente.set(
        'observacoes',
        'Cadastrado em 15/11/2026 a partir do informe do Rossini. Faltam telefone, documento e endereço completo (rua/número).',
      )
      app.save(cliente)
    }

    // ---- 2. obra -------------------------------------------------------
    let obra
    try {
      obra = app.findFirstRecordByData('obras', 'nome', OBRA)
    } catch (_) {
      obra = new Record(app.findCollectionByNameOrId('obras'))
      obra.set('nome', OBRA)
      obra.set('cliente', CLIENTE)
      obra.set('endereco', ENDERECO)
      // 'aguardando': data de início não informada; 2 dias de execução previstos.
      obra.set('status', 'aguardando')
      obra.set('cliente_ref', cliente.id)
      app.save(obra)
    }

    // ---- 3. orçamentos (serviço + comissão) ----------------------------
    const jaTemOrcamento = app.findRecordsByFilter('orcamentos', 'obra = {:o}', '', 1, 0, {
      o: obra.id,
    })

    if (jaTemOrcamento.length === 0) {
      const servico = new Record(app.findCollectionByNameOrId('orcamentos'))
      servico.set('cliente', CLIENTE)
      servico.set(
        'escopo',
        'Troca da central de automação Fibaro HC2 pela HC3 e reconfiguração de todo o sistema Z-Wave da casa. Mão de obra, 2 dias de execução.',
      )
      servico.set('valor', 3000)
      servico.set('status', 'aprovado')
      servico.set('obra', obra.id)
      app.save(servico)

      const comissao = new Record(app.findCollectionByNameOrId('orcamentos'))
      comissao.set('cliente', CLIENTE)
      comissao.set(
        'escopo',
        'Comissão sobre a venda da central Fibaro HC3. O cliente pagou R$ 8.300,00 direto ao fornecedor (R$ 5.000,00 da central + R$ 3.300,00 de comissão). Receita da AxiomTec, sem custo de equipamento.',
      )
      comissao.set('valor', 3300)
      comissao.set('status', 'aprovado')
      comissao.set('obra', obra.id)
      app.save(comissao)
    }

    // ---- 4. equipamento: HC3 do cliente, sem custo para a AxiomTec -----
    const jaTemEquip = app.findRecordsByFilter(
      'equipamentos',
      'obra = {:o} && modelo = "Home Center 3"',
      '',
      1,
      0,
      { o: obra.id },
    )

    if (jaTemEquip.length === 0) {
      const hc3 = new Record(app.findCollectionByNameOrId('equipamentos'))
      hc3.set('nome', 'Central de automação Fibaro HC3')
      hc3.set('marca', 'Fibaro')
      hc3.set('modelo', 'Home Center 3')
      hc3.set('cliente', cliente.id)
      hc3.set('obra', obra.id)
      hc3.set('local_instalacao', ENDERECO)
      // Comprada pelo cliente direto do fornecedor: não é custo da obra.
      hc3.set('valor_compra', 0)
      hc3.set(
        'observacoes',
        'Paga pelo cliente direto ao fornecedor por R$ 8.300,00 (R$ 5.000,00 da central + R$ 3.300,00 de comissão do Rossini). Não passa pelo caixa da AxiomTec: valor_compra fica 0 de propósito para não inflar o custo da obra. Substitui a HC2 existente no local.',
      )
      app.save(hc3)
    }

    // ---- 5. OS ---------------------------------------------------------
    const jaTemOS = app.findRecordsByFilter('ordens', 'obra = {:o}', '', 1, 0, { o: obra.id })

    if (jaTemOS.length === 0) {
      // Numeração pelo maior sufixo numérico existente. O sort por campo texto
      // quebra quando chega em OS-1000, então varremos e comparamos como número.
      let proximo = 1
      let todas = []
      try {
        todas = app.findRecordsByFilter('ordens', '', '', 500, 0)
      } catch (_) {
        todas = []
      }
      for (let i = 0; i < todas.length; i++) {
        const m = String(todas[i].get('numero') || '').match(/(\d+)\s*$/)
        if (m) {
          const n = parseInt(m[1], 10)
          if (n >= proximo) proximo = n + 1
        }
      }

      const ordem = new Record(app.findCollectionByNameOrId('ordens'))
      ordem.set('obra', obra.id)
      ordem.set('numero', 'OS-' + String(proximo).padStart(3, '0'))
      ordem.set('status', 'aberta')
      ordem.set(
        'descricao',
        'Troca da central Fibaro HC2 pela HC3 e reconfiguração de todo o sistema Z-Wave do cliente. Estimativa: 2 dias. Faltam data de início e técnico responsável.',
      )
      app.save(ordem)
    }
  },
  (app) => {
    // Reverte só o que esta migration criou, identificado pelo nome da obra.
    // Filhos primeiro: orcamentos e equipamentos não são cascade, então
    // apagar a obra direto deixaria registro órfão (ou falhar).
    let obraIds = []
    try {
      const obras = app.findRecordsByFilter('obras', 'nome = {:n}', '', 5, 0, { n: OBRA })
      for (let i = 0; i < obras.length; i++) obraIds.push(obras[i].id)
    } catch (_) {}

    for (let i = 0; i < obraIds.length; i++) {
      const o = obraIds[i]
      const filhos = [
        ['ordens', 'obra = {:o}'],
        ['orcamentos', 'obra = {:o}'],
        ['equipamentos', 'obra = {:o}'],
        ['recebimentos', 'obra = {:o}'],
      ]
      for (let f = 0; f < filhos.length; f++) {
        try {
          const achados = app.findRecordsByFilter(filhos[f][0], filhos[f][1], '', 500, 0, { o: o })
          for (let k = 0; k < achados.length; k++) app.delete(achados[k])
        } catch (_) {}
      }
      try {
        app.delete(app.findRecordById('obras', o))
      } catch (_) {}
    }

    try {
      const clientes = app.findRecordsByFilter('clientes', 'nome = {:n}', '', 5, 0, { n: CLIENTE })
      for (let i = 0; i < clientes.length; i++) app.delete(clientes[i])
    } catch (_) {}
  },
)
