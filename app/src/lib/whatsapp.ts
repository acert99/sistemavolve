// =============================================================================
// Evolution API — Integração WhatsApp
// Documentação: https://doc.evolution-api.com/v2
// Todas as mensagens são enviadas via instância configurada no .env
// =============================================================================

const EVOLUTION_URL  = process.env.EVOLUTION_API_URL!
const EVOLUTION_KEY  = process.env.EVOLUTION_API_KEY!
const INSTANCE_NAME  = process.env.EVOLUTION_INSTANCE_NAME ?? 'volve'

// Formata número para o padrão internacional sem símbolos: 5511999999999
function formatPhone(phone: string): string {
  return phone.replace(/\D/g, '')
}

// Headers comuns para todas as requisições
function headers() {
  return {
    'Content-Type': 'application/json',
    'apikey': EVOLUTION_KEY,
  }
}

// ---------------------------------------------------------------------------
// Envia mensagem de texto simples
// ---------------------------------------------------------------------------
export async function sendTextMessage(
  phone: string,
  text: string,
): Promise<boolean> {
  try {
    const number = formatPhone(phone)

    const res = await fetch(
      `${EVOLUTION_URL}/message/sendText/${INSTANCE_NAME}`,
      {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          number,
          text,
          delay: 500,  // ms de delay para simular digitação humana
        }),
      },
    )

    if (!res.ok) {
      const body = await res.text()
      console.error('[WhatsApp] Erro ao enviar mensagem:', res.status, body)
      return false
    }

    return true
  } catch (err) {
    console.error('[WhatsApp] Exceção ao enviar mensagem:', err)
    return false
  }
}

// ---------------------------------------------------------------------------
// Notificações de aprovação (enviadas para o cliente)
// ---------------------------------------------------------------------------
export async function notificarNovaEntrega(params: {
  phone: string
  clienteNome: string
  titulo: string
  linkPortal: string
}): Promise<boolean> {
  const { phone, clienteNome, titulo, linkPortal } = params

  const texto =
    `Olá, ${clienteNome}! 👋\n\n` +
    `Sua entrega *${titulo}* está pronta para revisão.\n\n` +
    `Acesse o link abaixo para aprovar ou solicitar ajustes:\n` +
    `${linkPortal}\n\n` +
    `_Equipe Volve_`

  return sendTextMessage(phone, texto)
}

// ---------------------------------------------------------------------------
// Notificação de cobrança (link de pagamento)
// ---------------------------------------------------------------------------
export async function notificarCobranca(params: {
  phone: string
  clienteNome: string
  descricao: string
  valor: number
  vencimento: Date
  linkPagamento: string
}): Promise<boolean> {
  const { phone, clienteNome, descricao, valor, vencimento, linkPagamento } = params

  const valorFormatado = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor)

  const vencimentoFormatado = new Intl.DateTimeFormat('pt-BR').format(vencimento)

  const texto =
    `Olá, ${clienteNome}! 👋\n\n` +
    `Você tem uma cobrança disponível:\n` +
    `📋 *${descricao}*\n` +
    `💰 Valor: ${valorFormatado}\n` +
    `📅 Vencimento: ${vencimentoFormatado}\n\n` +
    `Pague com PIX, boleto ou cartão:\n` +
    `${linkPagamento}\n\n` +
    `_Equipe Volve_`

  return sendTextMessage(phone, texto)
}

// ---------------------------------------------------------------------------
// Notificação de cobrança vencida (lembrete)
// ---------------------------------------------------------------------------
export async function notificarCobrancaVencida(params: {
  phone: string
  clienteNome: string
  descricao: string
  valor: number
  diasAtraso: number
  linkPagamento: string
}): Promise<boolean> {
  const { phone, clienteNome, descricao, valor, diasAtraso, linkPagamento } = params

  const valorFormatado = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor)

  const texto =
    `Olá, ${clienteNome}! ⚠️\n\n` +
    `Sua cobrança *${descricao}* está em aberto há ${diasAtraso} dia(s).\n` +
    `💰 Valor: ${valorFormatado}\n\n` +
    `Para regularizar, acesse:\n` +
    `${linkPagamento}\n\n` +
    `Qualquer dúvida, estamos à disposição! 😊\n` +
    `_Equipe Volve_`

  return sendTextMessage(phone, texto)
}

// ---------------------------------------------------------------------------
// Notificação de proposta enviada
// ---------------------------------------------------------------------------
export async function notificarProposta(params: {
  phone: string
  clienteNome: string
  tituloProposta: string
  valorTotal: number
  linkProposta: string
}): Promise<boolean> {
  const { phone, clienteNome, tituloProposta, valorTotal, linkProposta } = params

  const valorFormatado = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valorTotal)

  const texto =
    `Olá, ${clienteNome}! 🎉\n\n` +
    `Preparamos uma proposta especial para você:\n` +
    `📄 *${tituloProposta}*\n` +
    `💰 Investimento: ${valorFormatado}\n\n` +
    `Clique no link para ver todos os detalhes e aceitar:\n` +
    `${linkProposta}\n\n` +
    `_Equipe Volve_`

  return sendTextMessage(phone, texto)
}

// ---------------------------------------------------------------------------
// Notificação de contrato para assinatura
// ---------------------------------------------------------------------------
export async function notificarContrato(params: {
  phone: string
  clienteNome: string
  tituloContrato: string
  linkAssinatura: string
}): Promise<boolean> {
  const { phone, clienteNome, tituloContrato, linkAssinatura } = params

  const texto =
    `Olá, ${clienteNome}! 📝\n\n` +
    `Seu contrato *${tituloContrato}* está disponível para assinatura eletrônica.\n\n` +
    `Assine com segurança clicando no link:\n` +
    `${linkAssinatura}\n\n` +
    `_Equipe Volve_`

  return sendTextMessage(phone, texto)
}

// ---------------------------------------------------------------------------
// Verifica status da instância WhatsApp
// ---------------------------------------------------------------------------
export async function getInstanceStatus(): Promise<{
  connected: boolean
  status: string
}> {
  try {
    const res = await fetch(
      `${EVOLUTION_URL}/instance/connectionState/${INSTANCE_NAME}`,
      { headers: headers() },
    )

    if (!res.ok) {
      return { connected: false, status: 'error' }
    }

    const data = await res.json()
    const state = data?.instance?.state ?? 'unknown'

    return {
      connected: state === 'open',
      status: state,
    }
  } catch {
    return { connected: false, status: 'exception' }
  }
}
