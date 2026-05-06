import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextRequest, NextResponse } from 'next/server'
import { getPortfolioFolders, getTasksForMonth } from '@/lib/clickup'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const now = new Date()
  const year: number = body.year ?? now.getFullYear()
  const month: number = body.month ?? now.getMonth() + 1

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: 'GEMINI_API_KEY não configurada no servidor.' },
      { status: 500 },
    )
  }

  try {
    const portfolios = await getPortfolioFolders()

    const allTasksPerPortfolio = await Promise.all(
      portfolios.map((p) => getTasksForMonth(p.folderId, year, month)),
    )
    const tasks = allTasksPerPortfolio.flat()

    const taskLines = tasks
      .map(
        (t) =>
          `- ${t.name} | cliente: ${t.list?.name ?? 'desconhecido'} | status: ${t.status.status}`,
      )
      .join('\n')

    const MESES = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
    ]
    const nomeMes = MESES[month - 1]

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const prompt = `Você é estrategista de conteúdo sênior de uma agência de marketing digital chamada Volve.

Mês de referência: ${nomeMes}/${year}

Tarefas já cadastradas no ClickUp para este mês:
${taskLines || 'Nenhuma tarefa cadastrada ainda.'}

Gere exatamente 6 ideias de conteúdo estratégicas, variadas e complementares ao que já existe. Evite repetir temas já cobertos. Considere datas comemorativas, tendências e oportunidades do mês.

Retorne APENAS o seguinte JSON (array com 6 objetos), sem markdown, sem blocos de código:
[
  {
    "titulo": "título objetivo da ideia de conteúdo",
    "formato": "Post carrossel | Reels | Stories | Thread | Vídeo | Email | Blog",
    "dataSugerida": "YYYY-MM-DD",
    "justificativa": "explicação curta de por que essa ideia faz sentido agora"
  }
]`

    const result = await model.generateContent(prompt)
    const text = result.response.text().trim()

    const cleaned = text.startsWith('```') ? text.replace(/```json?\n?/g, '').replace(/```/g, '').trim() : text
    const ideias = JSON.parse(cleaned)

    return NextResponse.json({ success: true, data: ideias })
  } catch (err) {
    console.error('[calendario-conteudo/ideias/gerar]', err)
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
