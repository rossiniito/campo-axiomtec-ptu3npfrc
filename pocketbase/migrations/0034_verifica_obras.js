// VERIFICAÇÃO (leitura): registra no log o estado real das obras depois da
// migration 0033, para conferir se os cinco casos do Rossini foram gravados
// e se a Marina ficou intacta. Não altera nada.
migrate(
  (app) => {
    const obras = app.findAllRecords('obras')
    const linhas = []
    for (let i = 0; i < obras.length; i++) {
      const o = obras[i]
      linhas.push(
        String(o.get('nome')) +
          ' | status=' +
          String(o.get('status')) +
          ' | situacao=' +
          String(o.get('situacao') || '-').substring(0, 50) +
          ' | status_em=' +
          String(o.get('status_em') || '-'),
      )
    }
    console.log('VERIFICA OBRAS total=' + obras.length)
    for (let j = 0; j < linhas.length; j++) {
      console.log('VERIFICA OBRA ' + linhas[j])
    }
  },
  (app) => {},
)
