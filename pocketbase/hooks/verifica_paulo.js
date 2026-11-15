/* TEMPORÁRIO — conferência. Grava no log do backend o que a migration 0028
   criou, para eu ler o resultado real do banco. Removido em seguida.

   onBootstrap: e.next() é a PRIMEIRA instrução. Antes dele não existe banco,
   e qualquer $app.* segura um nil pointer (o catch não pega). */
onBootstrap((e) => {
  e.next()

  try {
    const obras = $app.findRecordsByFilter('obras', 'nome ~ "Paulo"', '', 10, 0)
    console.log('VERIFICA PAULO obras=' + obras.length)

    for (let i = 0; i < obras.length; i++) {
      const o = obras[i]
      const orc = $app.findRecordsByFilter('orcamentos', 'obra = {:o}', '', 50, 0, { o: o.id })
      const eq = $app.findRecordsByFilter('equipamentos', 'obra = {:o}', '', 50, 0, { o: o.id })
      const os = $app.findRecordsByFilter('ordens', 'obra = {:o}', '', 50, 0, { o: o.id })

      let soma = 0
      const detalhe = []
      for (let k = 0; k < orc.length; k++) {
        soma += orc[k].getFloat('valor')
        detalhe.push(String(orc[k].getFloat('valor')))
      }
      let custo = 0
      const eqs = []
      for (let k = 0; k < eq.length; k++) {
        custo += eq[k].getFloat('valor_compra')
        eqs.push(String(eq[k].get('modelo')) + '=' + String(eq[k].getFloat('valor_compra')))
      }
      const nums = []
      for (let k = 0; k < os.length; k++) nums.push(String(os[k].get('numero')))

      console.log(
        'VERIFICA PAULO OBRA | id=' +
          o.id +
          ' | nome=' +
          String(o.get('nome')) +
          ' | cliente=' +
          String(o.get('cliente')) +
          ' | status=' +
          String(o.get('status')) +
          ' | cliente_ref=' +
          String(o.get('cliente_ref')) +
          ' | nOrc=' +
          orc.length +
          ' | valores=' +
          detalhe.join('|') +
          ' | soma=' +
          soma +
          ' | nEquip=' +
          eq.length +
          ' | equip=' +
          eqs.join('|') +
          ' | custo=' +
          custo +
          ' | margem=' +
          (soma - custo) +
          ' | ordens=' +
          nums.join('|'),
      )
    }
  } catch (err) {
    console.log('VERIFICA PAULO ERRO ' + String(err))
  }
})
