// =============================================================================
// Autentique — Assinatura Eletrônica via GraphQL
// Documentação: https://autentique.com.br/documentacao
// API: https://api.autentique.com.br/v2/graphql
// =============================================================================

const AUTENTIQUE_URL = process.env.AUTENTIQUE_API_URL ?? 'https://api.autentique.com.br/v2/graphql'
const AUTENTIQUE_KEY = process.env.AUTENTIQUE_API_KEY!

// ---------------------------------------------------------------------------
// Tipos Autentique
// ---------------------------------------------------------------------------
export interface AutentiqueSigner {
  email: string
  name: string
  action?: 'SIGN' | 'APPROVE' | 'WITNESS'  // padrão: SIGN
}

export interface AutentiqueDocument {
  id: string
  name: string
  status: string
  created_at: string
  signatures: Array<{
    public_id: string
    name: string
    email: string
    signed: boolean
    signed_at: string | null
    link: string
  }>
  files?: {
    original?: string
    signed?: string
  }
}

// Executa uma query/mutation GraphQL no Autentique
async function graphql<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(AUTENTIQUE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AUTENTIQUE_KEY}`,
    },
    body: JSON.stringify({ query, variables }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`[Autentique] HTTP ${res.status}: ${err}`)
  }

  const json = await res.json()

  if (json.errors?.length) {
    throw new Error(
      `[Autentique] GraphQL error: ${json.errors.map((e: { message: string }) => e.message).join(', ')}`,
    )
  }

  return json.data as T
}

// ---------------------------------------------------------------------------
// Cria documento e envia para assinatura
// O conteúdo pode ser um HTML ou PDF em base64
// ---------------------------------------------------------------------------
export async function createDocument(params: {
  titulo: string
  conteudoHtml: string   // HTML do contrato
  signatarios: AutentiqueSigner[]
  mensagem?: string
}): Promise<AutentiqueDocument> {
  const { titulo, conteudoHtml, signatarios, mensagem } = params

  // Converte HTML para base64 (o Autentique aceita HTML como conteúdo)
  const contentBase64 = Buffer.from(conteudoHtml).toString('base64')

  const mutation = `
    mutation CreateDocument(
      $document: DocumentInput!
      $signers: [SignerInput!]!
      $file: Upload!
    ) {
      createDocument(document: $document, signers: $signers, file: $file) {
        id
        name
        status
        created_at
        signatures {
          public_id
          name
          email
          signed
          signed_at
          link
        }
        files {
          original
          signed
        }
      }
    }
  `

  // Autentique aceita upload multipart — como estamos enviando base64 via variável,
  // usamos a abordagem de envio por URL pré-assinada ou via blob
  // Para simplificar, usamos o endpoint REST de upload antes da criação:
  const uploadData = new FormData()
  const htmlBlob = new Blob([conteudoHtml], { type: 'text/html' })
  uploadData.append('file', htmlBlob, `${titulo.replace(/\s+/g, '_')}.html`)

  const uploadRes = await fetch('https://api.autentique.com.br/v2/upload', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${AUTENTIQUE_KEY}` },
    body: uploadData,
  })

  if (!uploadRes.ok) {
    throw new Error(`[Autentique] Erro no upload: ${await uploadRes.text()}`)
  }

  const uploadJson = await uploadRes.json()
  const fileId: string = uploadJson.id

  // Monta payload de criação sem variável de arquivo (usando file_id)
  const createMutation = `
    mutation CreateDocument($document: DocumentInput!, $signers: [SignerInput!]!) {
      createDocument(document: $document, signers: $signers) {
        id
        name
        status
        created_at
        signatures {
          public_id
          name
          email
          signed
          signed_at
          link
        }
        files {
          original
          signed
        }
      }
    }
  `

  const data = await graphql<{ createDocument: AutentiqueDocument }>(
    createMutation,
    {
      document: {
        name: titulo,
        message: mensagem ?? `Por favor, assine o documento "${titulo}".`,
        file_id: fileId,
      },
      signers: signatarios.map((s) => ({
        email: s.email,
        name: s.name,
        action: s.action ?? 'SIGN',
      })),
    },
  )

  return data.createDocument
}

// ---------------------------------------------------------------------------
// Busca informações de um documento pelo ID
// ---------------------------------------------------------------------------
export async function getDocument(
  documentId: string,
): Promise<AutentiqueDocument> {
  const query = `
    query GetDocument($id: UUID!) {
      document(id: $id) {
        id
        name
        status
        created_at
        signatures {
          public_id
          name
          email
          signed
          signed_at
          link
        }
        files {
          original
          signed
        }
      }
    }
  `

  const data = await graphql<{ document: AutentiqueDocument }>(query, {
    id: documentId,
  })

  return data.document
}

// ---------------------------------------------------------------------------
// Verifica se o documento foi completamente assinado
// ---------------------------------------------------------------------------
export async function isDocumentFullySigned(
  documentId: string,
): Promise<boolean> {
  const doc = await getDocument(documentId)
  return doc.signatures.every((sig) => sig.signed)
}

// ---------------------------------------------------------------------------
// Deleta um documento (somente documentos não assinados)
// ---------------------------------------------------------------------------
export async function deleteDocument(documentId: string): Promise<boolean> {
  const mutation = `
    mutation DeleteDocument($id: UUID!) {
      deleteDocument(id: $id)
    }
  `

  try {
    await graphql(mutation, { id: documentId })
    return true
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Valida assinatura HMAC do webhook do Autentique
// Header: x-autentique-signature
// ---------------------------------------------------------------------------
export async function validateWebhookSignature(
  payload: string,
  signature: string,
): Promise<boolean> {
  const secret = process.env.AUTENTIQUE_WEBHOOK_SECRET
  if (!secret) return false

  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)
  const msgData = encoder.encode(payload)

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  const sig = await crypto.subtle.sign('HMAC', cryptoKey, msgData)
  const expected = Buffer.from(sig).toString('hex')

  return expected === signature
}
