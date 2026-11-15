/* Resultado da última execução do vigia de propostas.

   Existe para o agente entregar o alerta sem recalcular a regra: o cron grava
   aqui, o agente lê. Uma linha por vigia (chave = "propostas"). */
migrate(
  (app) => {
    const vigia = new Collection({
      name: 'vigia_resultado',
      type: 'base',
      listRule: '@request.auth.perfil = "gestor"',
      viewRule: '@request.auth.perfil = "gestor"',
      createRule: null,
      updateRule: null,
      deleteRule: '@request.auth.perfil = "gestor"',
      fields: [
        { name: 'chave', type: 'text', required: true },
        { name: 'executado_em', type: 'date' },
        { name: 'total_alertas', type: 'number', onlyInt: true },
        { name: 'conteudo', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_vigia_chave ON vigia_resultado (chave)'],
    })
    app.save(vigia)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('vigia_resultado'))
    } catch (_) {
      /* já não existe */
    }
  },
)
