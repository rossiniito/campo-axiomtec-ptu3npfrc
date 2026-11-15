/* TEMPORÁRIO — diagnóstico. Confere se a migration 0028 gravou os registros da
   obra do Paulo. Removido logo após a conferência. */
routerAdd(
  'GET',
  '/backend/v1/verifica-paulo',
  (e) => {
    const out = {}
    let obraIds = []
    try {
      const obras = $app.findRecordsByFilter('obras', 'nome ~ "Paulo"', '', 10, 0)
      out.obras = obras.map((o) => ({
        id: o.id,
        nome: String(o.get('nome')),
        cliente: String(o.get('cliente')),
        status: String(o.get('status')),
        endereco: String(o.get('endereco')),
        cliente_ref: String(o.get('cliente_ref')),
      }))
      obraIds = obras.map((o) => o.id)
    } catch (err) {
      out.obras_erro = String(err)
    }

    try {
      const cs = $app.findRecordsByFilter('clientes', 'nome ~ "Paulo"', '', 10, 0)
      out.clientes = cs.map((c) => ({ id: c.id, nome: String(c.get('nome')) }))
    } catch (err) {
      out.clientes_erro = String(err)
    }

    for (let i = 0; i < obraIds.length; i++) {
      const o = obraIds[i]
      try {
        out['orcamentos_' + i] = $app
          .findRecordsByFilter('orcamentos', 'obra = {:o}', '', 50, 0, { o: o })
          .map((r) => ({
            cliente: String(r.get('cliente')),
            valor: r.getFloat('valor'),
            status: String(r.get('status')),
            escopo: String(r.get('escopo')).slice(0, 60),
          }))
      } catch (err) {
        out['orcamentos_erro_' + i] = String(err)
      }
      try {
        out['equipamentos_' + i] = $app
          .findRecordsByFilter('equipamentos', 'obra = {:o}', '', 50, 0, { o: o })
          .map((r) => ({
            nome: String(r.get('nome')),
            modelo: String(r.get('modelo')),
            valor_compra: r.getFloat('valor_compra'),
          }))
      } catch (err) {
        out['equipamentos_erro_' + i] = String(err)
      }
      try {
        out['ordens_' + i] = $app
          .findRecordsByFilter('ordens', 'obra = {:o}', '', 50, 0, { o: o })
          .map((r) => ({ numero: String(r.get('numero')), status: String(r.get('status')) }))
      } catch (err) {
        out['ordens_erro_' + i] = String(err)
      }
    }
    out.total_ordens_banco = $app.countRecords('ordens')
    return e.json(200, out)
  },
  $apis.requireSuperuserAuth(),
)
