// Modelos de checklist: o "jeito AxiomTec de instalar" guardado uma vez.
// A estrutura fica em JSON porque é um documento: lista de ambientes, cada um
// com seus itens. Não precisa de tabela própria para cada nível.
migrate(
  (app) => {
    const modelos = new Collection({
      name: 'modelos',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        { name: 'nome', type: 'text', required: true },
        { name: 'descricao', type: 'text' },
        {
          name: 'categoria',
          type: 'select',
          maxSelect: 1,
          values: ['automacao', 'av', 'redes', 'cftv', 'video_porteiro', 'outro'],
        },
        { name: 'ativo', type: 'bool' },
        {
          name: 'estrutura',
          type: 'json',
          maxSize: 200000,
          help: 'Lista de ambientes: [{ ambiente, itens: [nomes] }]',
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_modelos_nome ON modelos (nome)'],
    })
    app.save(modelos)

    // seed: modelo extraído do checklist real do Marina (a obra que já funciona)
    const automacao = new Record(app.findCollectionByNameOrId('modelos'))
    automacao.set('nome', 'Automação LifeSmart — padrão')
    automacao.set(
      'descricao',
      'Modelo base de automação residencial, a partir do checklist do Marina',
    )
    automacao.set('categoria', 'automacao')
    automacao.set('ativo', true)
    automacao.set(
      'estrutura',
      JSON.stringify([
        {
          ambiente: 'Suíte Master',
          itens: [
            'Smart Station',
            'Spot Mini',
            'Módulos Dimmer',
            'Módulos Reles',
            'Reles WC',
            'Dimmer 0-10 WC',
            'Rele Escritório',
            'Dimmer 0-10 escritório',
            'Persianas escritório',
            'Keystone quarto',
            'Keystone escritório',
          ],
        },
        {
          ambiente: 'Sala de estar',
          itens: [
            'Spot Mini',
            'Nature mini',
            'Dimmer',
            'Rele varanda',
            'Cortinas varanda',
            'Emissor IR para Ar condicionado e TV',
            'Configuração de câmeras',
          ],
        },
        {
          ambiente: 'Home Theater',
          itens: ['Caixas', 'Condicionador de energia', 'Receiver', 'TV', 'Passar cabo para IR'],
        },
      ]),
    )
    app.save(automacao)
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('modelos'))
  },
)
