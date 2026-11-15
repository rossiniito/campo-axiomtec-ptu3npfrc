// Status de obra mais rico: "aguardando / executando / finalizado" não dava
// conta da operação real. Faltava distinguir "esperando outra equipe",
// "finalizado mas faltando ajustes" e "entregue".
// Os três valores antigos ficam: há obra já gravada com eles.
migrate(
  (app) => {
    const obras = app.findCollectionByNameOrId('obras')

    const status = obras.fields.getByName('status')
    if (status) {
      status.values = [
        'aguardando',
        'aguardando_terceiros',
        'executando',
        'ajustes_finais',
        'finalizado',
        'entregue',
        'visita_tecnica',
      ]
    }

    // descrição livre do momento da obra ("faltando pequenos ajustes")
    if (!obras.fields.getByName('situacao')) {
      obras.fields.add(new TextField({ name: 'situacao' }))
    }
    // quando o status mudou pela última vez — para saber o que está parado
    if (!obras.fields.getByName('status_em')) {
      obras.fields.add(new DateField({ name: 'status_em' }))
    }

    app.save(obras)
  },
  (app) => {
    const obras = app.findCollectionByNameOrId('obras')
    const status = obras.fields.getByName('status')
    if (status) status.values = ['aguardando', 'executando', 'finalizado']
    obras.fields.removeByName('situacao')
    obras.fields.removeByName('status_em')
    app.save(obras)
  },
)
