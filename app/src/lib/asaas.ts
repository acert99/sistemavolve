// =============================================================================
// Asaas — Gateway de Pagamento Brasileiro
// Documentação: https://docs.asaas.com
// Suporte: boleto, PIX, cartão de crédito e débito
// =============================================================================

const ASAAS_API_URL = process.env.ASAAS_API_URL ?? 'https://api.asaas.com/v3'
const ASAAS_API_KEY = process.env.ASAAS_API_KEY!

function headers() {
  return {
    'Content-Type': 'application/json',
    'access_token': ASAAS_API_KEY,
  }
}

// ---------------------------------------------------------------------------
// Tipos Asaas
// ---------------------------------------------------------------------------
export interface AsaasCustomer {
  id: string
  name: string
  email: string
  cpfCnpj: string
  mobilePhone?: string
}

export interface AsaasCharge {
  id: string
  customer: string
  value: number
  netValue: number
  billingType: 'BOLETO' | 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'UNDEFINED'
  status: string
  dueDate: string
  invoiceUrl?: string
  bankSlipUrl?: string
  pixQrCodeId?: string
  nossoNumero?: string
}

export interface AsaasPixQrCode {
  encodedImage: string   // Base64 do QR code
  payload: string        // PIX copia e cola
  expirationDate: string
}

export interface CreateChargeParams {
  customerId: string          // ID do cliente no Asaas
  description: string
  value: number
  dueDate: string             // YYYY-MM-DD
  billingType?: 'BOLETO' | 'PIX' | 'CREDIT_CARD' | 'UNDEFINED'
  externalReference?: string  // ID interno para rastreio
}

// ---------------------------------------------------------------------------
// Cria ou recupera cliente no Asaas
// ---------------------------------------------------------------------------
export async function createOrFindCustomer(params: {
  nome: string
  email: string
  cpfCnpj?: string
  whatsapp?: string
}): Promise<AsaasCustomer> {
  const { nome, email, cpfCnpj, whatsapp } = params

  // Busca por CPF/CNPJ ou email
  const query = cpfCnpj
    ? `?cpfCnpj=${cpfCnpj}`
    : `?email=${encodeURIComponent(email)}`

  const searchRes = await fetch(`${ASAAS_API_URL}/customers${query}`, {
    headers: headers(),
  })

  if (searchRes.ok) {
    const searchData = await searchRes.json()
    if (searchData.data?.length > 0) {
      return searchData.data[0] as AsaasCustomer
    }
  }

  // Cria novo cliente
  const createRes = await fetch(`${ASAAS_API_URL}/customers`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      name: nome,
      email,
      cpfCnpj: cpfCnpj?.replace(/\D/g, ''),
      mobilePhone: whatsapp?.replace(/\D/g, ''),
      notificationDisabled: false,
    }),
  })

  if (!createRes.ok) {
    const err = await createRes.text()
    throw new Error(`[Asaas] Erro ao criar cliente: ${err}`)
  }

  return createRes.json() as Promise<AsaasCustomer>
}

// ---------------------------------------------------------------------------
// Cria uma cobrança (boleto / PIX / cartão)
// ---------------------------------------------------------------------------
export async function createCharge(
  params: CreateChargeParams,
): Promise<AsaasCharge> {
  const {
    customerId,
    description,
    value,
    dueDate,
    billingType = 'UNDEFINED',  // UNDEFINED = cliente escolhe na hora
    externalReference,
  } = params

  const res = await fetch(`${ASAAS_API_URL}/payments`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      customer: customerId,
      billingType,
      value,
      dueDate,
      description,
      externalReference,
      // Multa e juros padrão (2% multa + 1% ao mês)
      fine: { value: 2 },
      interest: { value: 1 },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`[Asaas] Erro ao criar cobrança: ${err}`)
  }

  return res.json() as Promise<AsaasCharge>
}

// ---------------------------------------------------------------------------
// Recupera QR Code PIX de uma cobrança existente
// ---------------------------------------------------------------------------
export async function getPixQrCode(chargeId: string): Promise<AsaasPixQrCode> {
  const res = await fetch(
    `${ASAAS_API_URL}/payments/${chargeId}/pixQrCode`,
    { headers: headers() },
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`[Asaas] Erro ao buscar QR Code PIX: ${err}`)
  }

  return res.json() as Promise<AsaasPixQrCode>
}

// ---------------------------------------------------------------------------
// Recupera uma cobrança pelo ID
// ---------------------------------------------------------------------------
export async function getCharge(chargeId: string): Promise<AsaasCharge> {
  const res = await fetch(
    `${ASAAS_API_URL}/payments/${chargeId}`,
    { headers: headers() },
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`[Asaas] Erro ao buscar cobrança: ${err}`)
  }

  return res.json() as Promise<AsaasCharge>
}

// ---------------------------------------------------------------------------
// Lista cobranças de um cliente
// ---------------------------------------------------------------------------
export async function listCustomerCharges(
  customerId: string,
  status?: string,
): Promise<AsaasCharge[]> {
  const query = new URLSearchParams({ customer: customerId })
  if (status) query.set('status', status)

  const res = await fetch(
    `${ASAAS_API_URL}/payments?${query.toString()}`,
    { headers: headers() },
  )

  if (!res.ok) {
    return []
  }

  const data = await res.json()
  return (data.data ?? []) as AsaasCharge[]
}

// ---------------------------------------------------------------------------
// Cancela / estorna uma cobrança
// ---------------------------------------------------------------------------
export async function deleteCharge(chargeId: string): Promise<boolean> {
  const res = await fetch(`${ASAAS_API_URL}/payments/${chargeId}`, {
    method: 'DELETE',
    headers: headers(),
  })

  return res.ok
}

// ---------------------------------------------------------------------------
// Valida o token de webhook do Asaas
// (o Asaas envia o token no header access_token)
// ---------------------------------------------------------------------------
export function validateWebhookToken(tokenFromHeader: string): boolean {
  const expected = process.env.ASAAS_WEBHOOK_TOKEN
  if (!expected) return false
  return tokenFromHeader === expected
}
