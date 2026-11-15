/* Contas PJ reais da AxiomTec — saldos de 15/11/2026.

   Dados do levantamento do Bot Financeiro (15/11/2026), cruzando avisos do
   BTG, Nubank, Cora, C6 e Inter.

   O ponto que muda tudo: a razão social é "Rossini Ito de Oliveira", o mesmo
   nome do sócio. R$ 32.000 que pareciam retirada para a PF eram PJ→PJ
   (R$ 2.000 em 25/08 e R$ 30.000 em 10/11). Por isso o app NUNCA classifica
   por nome — só por CNPJ/CPF e conta de destino.

   Segunda descoberta: 92% do caixa "da empresa" é dinheiro do Leandro (RealHT).
   Bruto R$ 29.670,84; próprio R$ 2.396,82. Por isso o valor de terceiro fica
   marcado na conta onde ele está de fato. */
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('contas')

    // saldo de referência de todas as contas: 15/11/2026
    const SALDO_EM = '2026-11-15 12:00:00.000Z'

    // [nome, banco, tipo, finalidade, saldo, terceiro, cartão?, limite, fatura, venc fatura]
    const dados = [
      [
        'BTG PJ — principal',
        'BTG Pactual',
        'corrente',
        'Conta principal: recebe quase todo PIX e TED de cliente',
        470.39,
        0,
        true,
        8000,
        1165.19,
        '2026-11-19 12:00:00.000Z',
      ],
      [
        'Nubank PJ',
        'Nubank',
        'investimento',
        'Parcerias + aplicação (reserva). Guarda parte do valor da RealHT',
        28629.02,
        27274.02,
        true,
        14600,
        8224.0,
        '2026-11-25 12:00:00.000Z',
      ],
      [
        'Cora PJ',
        'Cora',
        'capital_giro',
        'Capital de giro e cartão para compra grande de projeto',
        485.62,
        0,
        true,
        16050,
        13369.14,
        '2026-12-01 12:00:00.000Z',
      ],
      [
        'C6 PJ',
        'C6 Bank',
        'pagamento',
        'Conta de pagamento, uso secundário',
        77.84,
        0,
        true,
        2100,
        655.7,
        '2026-12-04 12:00:00.000Z',
      ],
      [
        'Inter PJ',
        'Inter',
        'pagamento',
        'Conta de pagamento, saldo residual',
        7.97,
        0,
        true,
        4000,
        0,
        '',
      ],
    ]

    for (let i = 0; i < dados.length; i++) {
      const d = dados[i]
      let reg = null
      try {
        reg = app.findFirstRecordByData('contas', 'nome', d[0])
      } catch (_) {
        reg = null
      }
      if (!reg) {
        reg = new Record(col)
        reg.set('nome', d[0])
      }
      reg.set('banco', d[1])
      reg.set('tipo', d[2])
      reg.set('finalidade', d[3])
      reg.set('saldo', d[4])
      reg.set('saldo_em', SALDO_EM)
      reg.set('valor_terceiro', d[5])
      reg.set('tem_cartao', d[6])
      reg.set('limite_cartao', d[7])
      reg.set('fatura_aberta', d[8])
      if (d[9]) reg.set('fatura_venc', d[9])
      reg.set('ativo', true)
      app.save(reg)
    }

    // Observações que precisam ficar registradas junto da conta, não só aqui.
    try {
      const nubank = app.findFirstRecordByData('contas', 'nome', 'Nubank PJ')
      nubank.set(
        'observacoes',
        'Saldo 28.629,02 = 3.576,37 em conta + 25.052,65 aplicado. Desse total, R$ 27.274,02 são da RealHT (Leandro) e vão ser devolvidos: caixa próprio desta conta é R$ 1.355,00. Fatura 8.224,00 = 527,20 em 25/11 + 7.696,80 (JBL) em 25/12.',
      )
      app.save(nubank)

      const inter = app.findFirstRecordByData('contas', 'nome', 'Inter PJ')
      inter.set(
        'observacoes',
        'Natureza do cartão Inter (limite R$ 4.000) ainda não confirmada com o Rossini.',
      )
      app.save(inter)

      const cora = app.findFirstRecordByData('contas', 'nome', 'Cora PJ')
      cora.set(
        'observacoes',
        'Cartão Cora com 83% do limite usado. Fatura de R$ 13.369,14 vence 01/12 e é a compra de equipamento da obra Laise/Negledson — cai 4 dias antes da parcela do cliente entrar.',
      )
      app.save(cora)
    } catch (_) {
      /* se alguma conta faltou, segue: os registros principais já gravaram */
    }

    // ---- config: piso e custo fixo corrigidos ----
    // O piso de R$ 26.493,58 que veio antes era 2× o burn CONSOLIDADO (PJ+PF),
    // misturando o custo da família. Para um app que trata só PJ, o número
    // certo é 2× a necessidade PJ.
    let cfg = null
    try {
      cfg = app.findFirstRecordByData('config_financeiro', 'chave', 'principal')
    } catch (_) {
      cfg = null
    }
    if (!cfg) {
      cfg = new Record(app.findCollectionByNameOrId('config_financeiro'))
      cfg.set('chave', 'principal')
    }
    cfg.set('custo_fixo_mensal', 14273.54)
    cfg.set('piso_caixa', 28547.08)
    cfg.set('break_even_mensal', 32558.94)
    cfg.set(
      'observacoes',
      'Necessidade PJ = 4.273,54 de custo fixo + 10.000 de pró-labore = 14.273,54/mês. Piso = 2× isso = 28.547,08 (só PJ). O piso anterior de 26.493,58 era 2× o burn consolidado PJ+PF e misturava custo da família. Break-even 32.558,94 = 14.273,54 ÷ 43,84% de margem.',
    )
    app.save(cfg)

    // ---- aportes históricos: R$ 20.490 em 8 Pix (17/03 a 10/07/2026) ----
    // O extrato não dá valor e data individual de cada um: registro o total
    // com essa ressalva, em vez de inventar 8 linhas.
    let jaTemAporte = []
    try {
      jaTemAporte = app.findRecordsByFilter('aportes', 'motivo ~ "histórico"', '', 1, 0)
    } catch (_) {
      jaTemAporte = []
    }
    if (jaTemAporte.length === 0) {
      const a = new Record(app.findCollectionByNameOrId('aportes'))
      a.set('valor', 20490)
      a.set('data', '2026-07-10 12:00:00.000Z')
      a.set('status', 'feito')
      a.set('motivo', 'Aporte de sócio — histórico (8 Pix de 17/03 a 10/07/2026)')
      a.set(
        'observacoes',
        'Total consolidado de 8 Pix. O extrato não traz valor e data de cada um: os valores individuais estão pendentes. Classificação fiscal pendente com o contador — entrou como Pix comum, sem contrato de mútuo localizado.',
      )
      app.save(a)
    }

    // ---- verificação: a liquidez própria tem de dar 2.396,82 ----
    const todas = app.findRecordsByFilter('contas', 'ativo = true', '', 100, 0)
    let bruto = 0
    let terceiro = 0
    for (let i = 0; i < todas.length; i++) {
      bruto += todas[i].getFloat('saldo') || 0
      terceiro += todas[i].getFloat('valor_terceiro') || 0
    }
    const proprio = bruto - terceiro
    if (Math.abs(bruto - 29670.84) > 0.05) {
      throw new Error('SALDO BRUTO ERRADO: ' + bruto + ' (esperado 29670.84)')
    }
    if (Math.abs(proprio - 2396.82) > 0.05) {
      throw new Error('LIQUIDEZ PROPRIA ERRADA: ' + proprio + ' (esperado 2396.82)')
    }
  },
  (app) => {
    try {
      const nomes = ['BTG PJ — principal', 'Nubank PJ', 'Cora PJ', 'C6 PJ', 'Inter PJ']
      for (let i = 0; i < nomes.length; i++) {
        const r = app.findRecordsByFilter('contas', 'nome = {:n}', '', 1, 0, { n: nomes[i] })
        for (let k = 0; k < r.length; k++) app.delete(r[k])
      }
    } catch (_) {
      /* nada a reverter */
    }
  },
)
