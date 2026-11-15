/* DIAGNÓSTICO TEMPORÁRIO — será removido.
   Retorna o estado das obras, clientes e ordens para conferência.
   Exige a chave em ?k= para não ficar aberto ao público. */
routerAdd('GET', '/backend/v1/diag/obras', (e) => {
  const k = String(e.requestInfo().query.k || '')
  if (k !== 'axiom-diag-2026-11') {
    return e.json(404, { error: 'not found' })
  }

  const obras = $app.findAllRecords('obras')
  const listaObras = []
  for (let i = 0; i < obras.length; i++) {
    const o = obras[i]
    listaObras.push({
      id: o.id,
      nome: String(o.get('nome')),
      cliente: String(o.get('cliente') || ''),
      status: String(o.get('status') || ''),
      situacao: String(o.get('situacao') || ''),
      status_em: String(o.get('status_em') || ''),
      arquiteta: String(o.get('arquiteta') || ''),
    })
  }

  return e.json(200, { total: obras.length, obras: listaObras })
})
