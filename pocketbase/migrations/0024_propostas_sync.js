/* Propostas vindas do sistema propostas.axiomtec.com.br.

   Por que uma cópia e não uma consulta ao vivo: aquele sistema é Next.js com
   banco próprio, e eu não tenho acesso ao código dele ainda. Guardando o
   evento aqui, o vigia de propostas funciona hoje e continua funcionando
   quando a integração mudar de forma.

   Um registro por proposta (proposta_id único): o evento atualiza, não duplica. */
migrate(
  (app) => {
    const propostas = new Collection({
      name: 'propostas',
      type: 'base',
      // Proposta carrega preço: só gestor. O alerta é só para o Rossini.
      listRule: '@request.auth.perfil = "gestor"',
      viewRule: '@request.auth.perfil = "gestor"',
      // Escrita só pelo servidor (hook do webhook). Nada de criar pela tela.
      createRule: null,
      updateRule: null,
      deleteRule: '@request.auth.perfil = "gestor"',
      fields: [
        { name: 'proposta_id', type: 'text', required: true },
        { name: 'projeto', type: 'text' },
        { name: 'cliente', type: 'text' },
        { name: 'valor', type: 'number' },
        {
          name: 'status',
          type: 'select',
          maxSelect: 1,
          values: ['rascunho', 'enviada', 'visualizada', 'aceita', 'recusada', 'expirada'],
        },
        { name: 'vendedor', type: 'text' },
        { name: 'enviada_em', type: 'date' },
        { name: 'primeira_abertura', type: 'date' },
        { name: 'ultima_atividade', type: 'date' },
        { name: 'visitas', type: 'number', onlyInt: true },
        { name: 'aceita_em', type: 'date' },
        { name: 'link_token', type: 'text' },
        {
          name: 'obra',
          type: 'relation',
          collectionId: app.findCollectionByNameOrId('obras').id,
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_propostas_proposta_id ON propostas (proposta_id)',
        'CREATE INDEX idx_propostas_status ON propostas (status)',
      ],
    })
    app.save(propostas)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('propostas'))
    } catch (_) {
      /* já não existe */
    }
  },
)
