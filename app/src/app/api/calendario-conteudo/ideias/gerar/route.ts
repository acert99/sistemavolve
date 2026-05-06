import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { getPortfolioFolders, getTasksForMonth } from '@/lib/clickup'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const now = new Date()
  const year: number = body.year ?? now.getFullYear()
  const month: number = body.month ?? now.getMonth() + 1

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

    const client = new Anthropic()

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system:
        'Você é estrategista de conteúdo sênior de uma agência de marketing digital chamada Volve. Responda SEMPRE com JSON válido puro, sem markdown, sem blocos de código.',
      messages: [
        {
          role: 'user',
          content: `Mês de referência: ${nomeMes}/${year}

Tarefas já cadastradas no ClickUp para este mês:
${taskLines || 'Nenhuma tarefa cadastrada ainda.'}

Gere exatamente 6 ideias de conteúdo estratégicas, variadas e complementares ao que já existe. Evite repetir temas já cobertos. Considere datas comemorativas, tendências e oportunidades do mês.

Retorne APENAS o seguinte JSON (array com 6 objetos):
[
  {
    "titulo": "título objetivo da ideia de conteúdo",
    "formato": "Post carrossel | Reels | Stories | Thread | Vídeo | Email | Blog",
    "dataSugerida": "YYYY-MM-DD",
    "justificativa": "explicação curta de por que essa ideia faz sentido agora"
  }
]`,
        },
      ],
    })

    const content = response.content[0]
    if (content.type !== 'text') {
      throw new Error('Resposta inesperada da IA')
    }

    const ideias = JSON.parse(content.text)

    return NextResponse.json({ success: true, data: ideias })
  } catch (err) {
    console.error('[calendario-conteudo/ideias/gerar]', err)
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
