/* Visão financeira geral: sobe o que tem data e valor concretos.

   Fonte: levantamento do Bot Financeiro (15/11/2026) sobre os extratos, mais o
   que o Rossini informou na conversa.

   O QUE ENTRA (tem valor E data):
   - Obra Laise/Negledson: R$ 77.482,73 de contrato. Sinal de 40% (R$ 30.993,09)
     já recebido em 05/11 por PIX, e 4 parcelas de R$ 11.622,41 em 05/12, 05/01,
     05/02 e 05/03.
   - Faturas de cartão PJ em aberto (5, com valor e vencimento exatos).
   - Custo de equipamento da Laise (R$ 13.369,14 foi para o cartão Cora): entra
     como equipamento para a margem, e como conta a pagar para o caixa. Não é
     duplicidade: são dimensões diferentes — uma é custo, outra é data de saída
     do dinheiro.

   O QUE NÃO ENTRA, de propósito:
   - O total "a receber R$ 71.021,22" e "a pagar R$ 68.297,97" do levantamento.
     Esses números são AGREGADOS e já incluem as parcelas da Laise e as faturas
     de cartão. Lançar os dois lados contaria o mesmo dinheiro duas vezes e a
     projeção mentiria — para cima no que entra e para baixo no que sai. Ficam
     pendentes de detalhamento por item.
   - O faturamento da Fairfax (R$ 246.379) porque foi faturado pela RealHT e
     pela LedWave, não pela AxiomTec. Não é receita dela. */
migrate(
  (app) => {
    // ---------- 1. obra Laise / Negledson ----------
    const NOME_CLIENTE = 'Laise e Negledson'
    let cliente = null
    try {
      cliente = app.findFirstRecordByData('clientes', 'nome', NOME_CLIENTE)
    } catch (_) {
      cliente = null
    }
    if (!cliente) {
      cliente = new Record(app.findCollectionByNameOrId('clientes'))
      cliente.set('nome', NOME_CLIENTE)
      cliente.set('tipo', 'residencial')
      cliente.set('ativo', true)
      cliente.set(
        'observacoes',
        'Contrato de 15/08/2026. Entrada de 40% + 4 parcelas mensais de 15%. Dados do levantamento de 15/11/2026.',
      )
      app.save(cliente)
    }

    const NOME_OBRA = 'Laise e Negledson'
    let obra = null
    try {
      obra = app.findFirstRecordByData('obras', 'nome', NOME_OBRA)
    } catch (_) {
      obra = null
    }
    if (!obra) {
      obra = new Record(app.findCollectionByNameOrId('obras'))
      obra.set('nome', NOME_OBRA)
      obra.set('cliente', NOME_CLIENTE)
      obra.set('cliente_ref', cliente.id)
      obra.set('status', 'executando')
      app.save(obra)
    }

    // ---------- 2. orçamento aprovado (o valor do contrato) ----------
    const TOTAL = 77482.73
    let orc = null
    try {
      const achados = app.findRecordsByFilter(
        'orcamentos',
        'obra = {:o} && status = "aprovado"',
        '',
        1,
        0,
        { o: obra.id },
      )
      if (achados.length > 0) orc = achados[0]
    } catch (_) {
      orc = null
    }
    if (!orc) {
      orc = new Record(app.findCollectionByNameOrId('orcamentos'))
      orc.set('cliente', NOME_CLIENTE)
      orc.set(
        'escopo',
        'Projeto de automação e áudio/vídeo. Contrato de 15/08/2026. Valor total R$ 77.482,73 dividido em 40% de entrada e 4 parcelas de 15%.',
      )
      orc.set('valor', TOTAL)
      orc.set('status', 'aprovado')
      orc.set('obra', obra.id)
      orc.set('data_aprovacao', '2026-08-15 12:00:00.000Z')
      app.save(orc)
    }

    // ---------- 3. recebimentos ----------
    // Idempotente por descrição: rodar de novo não duplica.
    const criarReceb = (descricao, tipo, valor, vencimento, status, recebidoEm, forma) => {
      let ja = []
      try {
        ja = app.findRecordsByFilter('recebimentos', 'obra = {:o} && descricao = {:d}', '', 1, 0, {
          o: obra.id,
          d: descricao,
        })
      } catch (_) {
        ja = []
      }
      if (ja.length > 0) return

      const r = new Record(app.findCollectionByNameOrId('recebimentos'))
      r.set('obra', obra.id)
      r.set('orcamento', orc.id)
      r.set('tipo', tipo)
      r.set('descricao', descricao)
      r.set('percentual', tipo === 'sinal' ? 40 : 15)
      r.set('valor', valor)
      r.set('vencimento', vencimento)
      r.set('status', status)
      if (recebidoEm) r.set('recebido_em', recebidoEm)
      if (status === 'recebido') r.set('valor_recebido', valor)
      if (forma) r.set('forma', forma)
      r.set(
        'observacoes',
        'Lançado em 15/11/2026 a partir do levantamento de extratos. Não é o padrão 40/30/30: é a exceção negociada da Laise/Negledson (40% + 4x15%).',
      )
      app.save(r)
    }

    criarReceb(
      'Sinal 40% — recebido em 05/11/2026',
      'sinal',
      30993.09,
      '2026-11-05 12:00:00.000Z',
      'recebido',
      '2026-11-05 12:00:00.000Z',
      'pix',
    )
    criarReceb(
      'Parcela 1 de 4 (15%)',
      'parcela',
      11622.41,
      '2026-12-05 12:00:00.000Z',
      'a_receber',
      '',
      '',
    )
    criarReceb(
      'Parcela 2 de 4 (15%)',
      'parcela',
      11622.41,
      '2027-01-05 12:00:00.000Z',
      'a_receber',
      '',
      '',
    )
    criarReceb(
      'Parcela 3 de 4 (15%)',
      'parcela',
      11622.41,
      '2027-02-05 12:00:00.000Z',
      'a_receber',
      '',
      '',
    )
    criarReceb(
      'Parcela 4 de 4 (15%)',
      'parcela',
      11622.41,
      '2027-03-05 12:00:00.000Z',
      'a_receber',
      '',
      '',
    )

    // ---------- 4. equipamento da Laise (para a margem) ----------
    // Foi para o cartão Cora: é custo da obra. Entra com valor para a margem
    // não mostrar lucro inflado.
    let jaEquip = []
    try {
      jaEquip = app.findRecordsByFilter('equipamentos', 'obra = {:o}', '', 5, 0, { o: obra.id })
    } catch (_) {
      jaEquip = []
    }
    if (jaEquip.length === 0) {
      const eq = new Record(app.findCollectionByNameOrId('equipamentos'))
      eq.set('nome', 'Equipamentos do projeto (compra no cartão Cora)')
      eq.set('cliente', cliente.id)
      eq.set('obra', obra.id)
      eq.set('valor_compra', 13369.14)
      eq.set('data_compra', '2026-11-01 12:00:00.000Z')
      eq.set('local_instalacao', NOME_OBRA)
      eq.set(
        'observacoes',
        'Compra de equipamento da obra no cartão Cora, fatura de R$ 13.369,14 vencendo 01/12/2026. Custo real da obra para o cálculo de margem; a saída de caixa está lançada em pagamentos.',
      )
      app.save(eq)
    }

    // ---------- 5. faturas de cartão como conta a pagar ----------
    const faturas = [
      ['Fatura cartão BTG Gold', 1165.19, '2026-11-19 12:00:00.000Z', 'estrutura'],
      ['Fatura cartão Nubank PJ (parcial 25/11)', 527.2, '2026-11-25 12:00:00.000Z', 'estrutura'],
      [
        'Fatura cartão Cora — equipamento obra Laise/Negledson',
        13369.14,
        '2026-12-01 12:00:00.000Z',
        'equipamento',
      ],
      ['Fatura cartão C6 PJ', 655.7, '2026-12-04 12:00:00.000Z', 'estrutura'],
      ['Fatura cartão Nubank PJ — JBL', 7696.8, '2026-12-25 12:00:00.000Z', 'equipamento'],
    ]

    for (let i = 0; i < faturas.length; i++) {
      const f = faturas[i]
      let ja = []
      try {
        ja = app.findRecordsByFilter('pagamentos', 'descricao = {:d}', '', 1, 0, { d: f[0] })
      } catch (_) {
        ja = []
      }
      if (ja.length > 0) continue

      const p = new Record(app.findCollectionByNameOrId('pagamentos'))
      p.set('descricao', f[0])
      p.set('valor', f[1])
      p.set('vencimento', f[2])
      p.set('status', 'a_pagar')
      p.set('categoria', f[3])
      if (f[3] === 'equipamento' && f[0].indexOf('Cora') !== -1) {
        p.set('obra', obra.id)
      }
      p.set(
        'observacoes',
        'Fatura de cartão PJ do levantamento de 15/11/2026. A fatura do cartão Inter (limite R$ 4.000) não entrou porque a natureza ainda não foi confirmada.',
      )
      app.save(p)
    }

    // ---------- 6. verificação ----------
    const recebs = app.findRecordsByFilter('recebimentos', 'obra = {:o}', '', 500, 0, {
      o: obra.id,
    })
    let totalReceb = 0
    let aberto = 0
    let recebido = 0
    for (let i = 0; i < recebs.length; i++) {
      const v = recebs[i].getFloat('valor') || 0
      totalReceb += v
      const st = String(recebs[i].getString('status') || '')
      if (st === 'recebido') recebido += v
      if (st === 'a_receber') aberto += v
    }
    if (Math.abs(totalReceb - TOTAL) > 0.05) {
      throw new Error('RECEBIMENTOS NAO FECHAM: ' + totalReceb + ' vs contrato ' + TOTAL)
    }
    if (Math.abs(recebido - 30993.09) > 0.05) {
      throw new Error('SINAL ERRADO: ' + recebido)
    }
    if (Math.abs(aberto - 46489.64) > 0.05) {
      throw new Error('PARCELAS ABERTAS ERRADAS: ' + aberto)
    }

    const pags = app.findRecordsByFilter('pagamentos', 'status = "a_pagar"', '', 500, 0)
    let totalPagar = 0
    for (let i = 0; i < pags.length; i++) totalPagar += pags[i].getFloat('valor') || 0
    // DAS 2.096,77 + 5 faturas 23.414,03 = 25.510,80
    if (Math.abs(totalPagar - 25510.8) > 0.05) {
      throw new Error('CONTAS A PAGAR ERRADAS: ' + totalPagar)
    }
  },
  (app) => {
    try {
      const obras = app.findRecordsByFilter('obras', 'nome = "Laise e Negledson"', '', 2, 0)
      for (let i = 0; i < obras.length; i++) {
        const o = obras[i].id
        const filhos = ['recebimentos', 'orcamentos', 'equipamentos']
        for (let k = 0; k < filhos.length; k++) {
          const r = app.findRecordsByFilter(filhos[k], 'obra = {:o}', '', 500, 0, { o: o })
          for (let j = 0; j < r.length; j++) app.delete(r[j])
        }
        app.delete(obras[i])
      }
      const cli = app.findRecordsByFilter('clientes', 'nome = "Laise e Negledson"', '', 2, 0)
      for (let i = 0; i < cli.length; i++) app.delete(cli[i])
    } catch (_) {
      /* nada a reverter */
    }
  },
)
