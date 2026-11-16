/* Fase 1 do ciclo: cliente, fornecedor, equipamento (série/garantia),
   chamado de pós-venda e contrato de manutenção. */
import pb from '@/lib/pocketbase/client'

export type Cliente = {
  id: string
  nome: string
  tipo?: 'residencial' | 'corporativo' | 'condominio'
  email?: string
  telefone?: string
  endereco?: string
  arquiteta?: string
  observacoes?: string
  ativo?: boolean
}

export type Fornecedor = {
  id: string
  nome: string
  contato?: string
  telefone?: string
  email?: string
  site?: string
  prazo_medio_dias?: number
  observacoes?: string
  ativo?: boolean
}

export type Equipamento = {
  id: string
  nome: string
  marca?: string
  modelo?: string
  numero_serie?: string
  patrimonio?: string
  cliente?: string
  obra?: string
  fornecedor?: string
  data_compra?: string
  valor_compra?: number
  garantia_meses?: number
  garantia_ate?: string
  nota_fiscal_numero?: string
  nota_fiscal_arquivo?: string
  local_instalacao?: string
  ip?: string
  mac?: string
  status?: 'em_estoque' | 'instalado' | 'com_defeito' | 'em_garantia' | 'devolvido'
  observacoes?: string
  foto?: string[]
  expand?: {
    cliente?: Cliente
    obra?: { id: string; nome: string }
    fornecedor?: Fornecedor
  }
}

export type Chamado = {
  id: string
  numero: string
  titulo: string
  descricao?: string
  cliente: string
  obra?: string
  equipamento?: string
  tipo?: 'corretiva' | 'preventiva' | 'garantia' | 'instalacao' | 'duvida'
  prioridade?: 'baixa' | 'normal' | 'alta' | 'urgente'
  status?: 'aberto' | 'agendado' | 'em_andamento' | 'resolvido' | 'cancelado'
  tecnico?: string
  created?: string
  aberto_em?: string
  agendado_para?: string
  fechado_em?: string
  coberto_garantia?: boolean
  custo?: number
  solucao?: string
  expand?: { cliente?: Cliente; equipamento?: Equipamento; obra?: { id: string; nome: string } }
}

export type Contrato = {
  id: string
  nome: string
  cliente: string
  tipo?: 'manutencao' | 'monitoramento' | 'suporte' | 'misto'
  inicio?: string
  fim?: string
  valor?: number
  periodicidade?: 'mensal' | 'trimestral' | 'semestral' | 'anual'
  visitas_por_ano?: number
  status?: 'ativo' | 'suspenso' | 'encerrado'
  observacoes?: string
  expand?: { cliente?: Cliente }
}

export const ROTULO_EQUIP: Record<string, string> = {
  em_estoque: 'Em estoque',
  instalado: 'Instalado',
  com_defeito: 'Com defeito',
  em_garantia: 'Em garantia',
  devolvido: 'Devolvido',
}

export const ROTULO_CHAMADO: Record<string, string> = {
  aberto: 'Aberto',
  agendado: 'Agendado',
  em_andamento: 'Em andamento',
  resolvido: 'Resolvido',
  cancelado: 'Cancelado',
}

export const ROTULO_PRIORIDADE: Record<string, string> = {
  baixa: 'Baixa',
  normal: 'Normal',
  alta: 'Alta',
  urgente: 'Urgente',
}

export const ROTULO_TIPO_CHAMADO: Record<string, string> = {
  corretiva: 'Corretiva',
  preventiva: 'Preventiva',
  garantia: 'Garantia',
  instalacao: 'Instalação',
  duvida: 'Dúvida',
}

/* ---------- clientes ---------- */
export async function listarClientes(): Promise<Cliente[]> {
  return (await pb.collection('clientes').getFullList({ sort: 'nome' })) as unknown as Cliente[]
}

export async function criarCliente(dados: Partial<Cliente>) {
  return (await pb.collection('clientes').create(dados)) as unknown as Cliente
}

/* ---------- fornecedores ---------- */
export async function listarFornecedores(): Promise<Fornecedor[]> {
  return (await pb.collection('fornecedores').getFullList({
    sort: 'nome',
  })) as unknown as Fornecedor[]
}

export async function criarFornecedor(dados: Partial<Fornecedor>) {
  return (await pb.collection('fornecedores').create(dados)) as unknown as Fornecedor
}

/* ---------- equipamentos ---------- */
export async function listarEquipamentos(): Promise<Equipamento[]> {
  return (await pb.collection('equipamentos').getFullList({
    sort: '-created',
    expand: 'cliente,obra,fornecedor',
  })) as unknown as Equipamento[]
}

export async function criarEquipamento(dados: Record<string, unknown>) {
  return (await pb.collection('equipamentos').create(dados)) as unknown as Equipamento
}

export async function atualizarEquipamento(id: string, dados: Record<string, unknown>) {
  return (await pb.collection('equipamentos').update(id, dados)) as unknown as Equipamento
}

/** Garantia vencida, vencendo em 30 dias, ou ok. */
export function situacaoGarantia(eq: Equipamento): 'vencida' | 'vencendo' | 'ok' | 'sem_dado' {
  if (!eq.garantia_ate) return 'sem_dado'
  const fim = new Date(eq.garantia_ate).getTime()
  if (Number.isNaN(fim)) return 'sem_dado'
  const agora = Date.now()
  if (fim < agora) return 'vencida'
  if (fim - agora < 30 * 24 * 3600 * 1000) return 'vencendo'
  return 'ok'
}

/** Calcula garantia_ate a partir da data de compra + meses. */
export function calcularGarantia(dataCompra?: string, meses?: number): string | null {
  if (!dataCompra || !meses) return null
  const d = new Date(dataCompra)
  if (Number.isNaN(d.getTime())) return null
  d.setMonth(d.getMonth() + Number(meses))
  return d.toISOString()
}

/* ---------- chamados ---------- */
export async function listarChamados(): Promise<Chamado[]> {
  return (await pb.collection('chamados').getFullList({
    sort: '-created',
    expand: 'cliente,equipamento,obra',
  })) as unknown as Chamado[]
}

export async function criarChamado(dados: Record<string, unknown>) {
  return (await pb.collection('chamados').create(dados)) as unknown as Chamado
}

export async function atualizarChamado(id: string, dados: Record<string, unknown>) {
  return (await pb.collection('chamados').update(id, dados)) as unknown as Chamado
}

/** Próximo número de chamado: CH-001, CH-002... */
export async function proximoNumeroChamado(): Promise<string> {
  const ultimos = (await pb.collection('chamados').getList(1, 1, {
    sort: '-numero',
  })) as unknown as { items: Chamado[] }
  const atual = ultimos.items[0]?.numero ?? ''
  const m = atual.match(/(\d+)\s*$/)
  const proximo = m ? parseInt(m[1], 10) + 1 : 1
  return 'CH-' + String(proximo).padStart(3, '0')
}

/* ---------- contratos ---------- */
export async function listarContratos(): Promise<Contrato[]> {
  return (await pb.collection('contratos').getFullList({
    sort: '-created',
    expand: 'cliente',
  })) as unknown as Contrato[]
}

export async function criarContrato(dados: Record<string, unknown>) {
  return (await pb.collection('contratos').create(dados)) as unknown as Contrato
}

export type ResumoRecorrente = { ativos: number; valorMensal: number; valorAnual: number }

/** Receita recorrente aproximada dos contratos ativos. */
export function resumirContratos(lista: Contrato[]): ResumoRecorrente {
  const ativos = lista.filter((c) => c.status === 'ativo')
  let mensal = 0
  for (const c of ativos) {
    const v = c.valor ?? 0
    if (c.periodicidade === 'mensal') mensal += v
    else if (c.periodicidade === 'trimestral') mensal += v / 3
    else if (c.periodicidade === 'semestral') mensal += v / 6
    else if (c.periodicidade === 'anual') mensal += v / 12
  }
  return {
    ativos: ativos.length,
    valorMensal: Math.round(mensal),
    valorAnual: Math.round(mensal * 12),
  }
}
