/* Registra o DAS de novembro informado pelo Rossini em 12/11/2026.

   Valor e data vieram dele, não de estimativa: R$ 2.096,77 vencendo 23/11/2026.
   Entra como conta a pagar para aparecer na projeção de caixa dos próximos 30
   dias — que é exatamente a janela em que ele está agora.

   Idempotente: se já existir uma conta "DAS" com esse vencimento, não duplica. */
migrate(
  (app) => {
    const vencimento = '2026-11-23 12:00:00.000Z'
    let existentes = []
    try {
      existentes = app.findRecordsByFilter(
        'pagamentos',
        'descricao ~ "DAS" && vencimento = {:v}',
        '',
        5,
        0,
        { v: vencimento },
      )
    } catch (_) {
      existentes = []
    }
    if (existentes.length > 0) return

    const p = new Record(app.findCollectionByNameOrId('pagamentos'))
    p.set('descricao', 'DAS Simples Nacional — novembro/2026')
    p.set('valor', 2096.77)
    p.set('vencimento', vencimento)
    p.set('status', 'a_pagar')
    p.set('categoria', 'imposto')
    p.set('observacoes', 'Informado pelo Rossini em 12/11/2026.')
    app.save(p)
  },
  (app) => {
    try {
      const achados = app.findRecordsByFilter(
        'pagamentos',
        'descricao ~ "DAS Simples Nacional" && valor = 2096.77',
        '',
        5,
        0,
      )
      for (let i = 0; i < achados.length; i++) app.delete(achados[i])
    } catch (_) {
      /* nada a desfazer */
    }
  },
)
