type GeminiTextResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>
    }
  }>
}

function getGeminiKey() {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('[Gemini] GEMINI_API_KEY nao configurado')
  return key
}

export async function geminiGenerateJson<T>(options: {
  model?: string
  prompt: string
  timeoutMs?: number
  maxOutputTokens?: number
}): Promise<T> {
  const model = options.model ?? 'gemini-2.0-flash'
  const timeoutMs = options.timeoutMs ?? 25_000
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const url = new URL(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    )
    url.searchParams.set('key', getGeminiKey())

    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: options.prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: options.maxOutputTokens ?? 700,
        },
      }),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`[Gemini] request falhou: ${text}`)
    }

    const data = (await res.json()) as GeminiTextResponse
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
    const trimmed = text.trim()

    // tenta extrair json mesmo se vier embrulhado em ```json
    const jsonText = trimmed
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim()

    return JSON.parse(jsonText) as T
  } finally {
    clearTimeout(timeout)
  }
}

