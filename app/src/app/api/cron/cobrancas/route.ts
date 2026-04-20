// =============================================================================
// Cron — Notificações de cobrança vencida via WhatsApp
// GET /api/cron/cobrancas
// Executar diariamente às 9h: 0 9 * * *
// Proteção: header Authorization: Bearer CRON_SECRET
//
// Para agendar (VPS com cron):
//   0 9 * * * curl -s -H "Authorization: Bearer SEU_CRON_SECRET" \
//              https://app.volve.com.br/api/cron/cobrancas
//
// Para agendar (Vercel Cron — vercel.json):
//   { "crons": [{ "path": "/api/cron/cobrancas", "schedule": "0 9 * * *" }] }
// =============================================================================
import { NextRequest, NextResponse } from 'next/server'
import { addDays } from 'date-fns'
import prisma from '@/lib/prisma'
import {
  differenceInAppCalendarDays,
  getAppDayRange,
  getDateKeyInAppTimeZone,
} from '@/lib/timezone'
import { notificarCobrancaVencida, notificarCobranca } from '@/lib/whatsapp'

export async function GET(request: NextRequest) {
  // Validação do CRON_SECRET
  const authHeader = request.headers.get('authorization') ?? ''
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { success: false, error: 'Não autorizado' },
      { status: 401 },
    )
  }

  const agora = new Date()
  const hojeKey = getDateKeyInAppTimeZone(agora)
  const { start: hojeInicio } = getAppDayRange(agora)
  const { start: amanhaInicio, end: amanhaFim } = getAppDayRange(addDays(agora, 1))
  const resultados = {
    notificacoesVencidas: 0,
    lembretesProximosVencimento: 0,
    erros: 0,
  }

  try {
    // -------------------------------------------------------------------------
    // 1. Cobranças VENCIDAS (status OVERDUE) — notificar se passaram mais de
    //    1, 3, 7 ou 15 dias do vencimento (evita spam diário)
    // -------------------------------------------------------------------------
    const cobrancasVencidas = await prisma.cobranca.findMany({
      where: {
        status: 'OVERDUE',
        cliente: {
          whatsapp: { not: null },
          ativo: true,
        },
      },
      include: {
        cliente: {
          select: { id: true, nome: true, whatsapp: true },
        },
      },
      orderBy: { vencimento: 'asc' },
    })

    for (const cobranca of cobrancasVencidas) {
      const diasAtraso = differenceInAppCalendarDays(agora, cobranca.vencimento)

      // Só notifica em intervalos específicos: 1, 3, 7, 15 dias
      const intervalosNotificacao = [1, 3, 7, 15]
      if (!intervalosNotificacao.includes(diasAtraso)) continue

      // Verifica se já foi notificado hoje (evita duplicatas se o cron rodar 2x)
      if (cobranca.notificadoEm) {
        const ultimaNotificacaoKey = getDateKeyInAppTimeZone(cobranca.notificadoEm)
        if (ultimaNotificacaoKey === hojeKey) continue
      }

      try {
        await notificarCobrancaVencida({
          phone: cobranca.cliente.whatsapp!,
          clienteNome: cobranca.cliente.nome,
          descricao: cobranca.descricao,
          valor: Number(cobranca.valor),
          diasAtraso,
          linkPagamento: cobranca.linkPagamento ?? cobranca.invoiceUrl ?? '',
        })

        await prisma.cobranca.update({
          where: { id: cobranca.id },
          data: { notificadoEm: new Date() },
        })

        resultados.notificacoesVencidas++
      } catch (err) {
        console.error(`[Cron] Erro ao notificar cobrança vencida ${cobranca.id}:`, err)
        resultados.erros++
      }
    }

    // -------------------------------------------------------------------------
    // 2. Cobranças PENDENTES com vencimento amanhã — lembrete preventivo
    // -------------------------------------------------------------------------
    const cobrancasProximas = await prisma.cobranca.findMany({
      where: {
        status: 'PENDING',
        vencimento: {
          gte: amanhaInicio,
          lt: amanhaFim,
        },
        cliente: {
          whatsapp: { not: null },
          ativo: true,
        },
        // Não notificar os que já foram avisados hoje
        OR: [
          { notificadoEm: null },
          { notificadoEm: { lt: hojeInicio } },
        ],
      },
      include: {
        cliente: {
          select: { id: true, nome: true, whatsapp: true },
        },
      },
    })

    for (const cobranca of cobrancasProximas) {
      try {
        await notificarCobranca({
          phone: cobranca.cliente.whatsapp!,
          clienteNome: cobranca.cliente.nome,
          descricao: cobranca.descricao,
          valor: Number(cobranca.valor),
          vencimento: cobranca.vencimento,
          linkPagamento: cobranca.linkPagamento ?? cobranca.invoiceUrl ?? '',
        })

        await prisma.cobranca.update({
          where: { id: cobranca.id },
          data: { notificadoEm: new Date() },
        })

        resultados.lembretesProximosVencimento++
      } catch (err) {
        console.error(`[Cron] Erro ao enviar lembrete ${cobranca.id}:`, err)
        resultados.erros++
      }
    }

    console.log('[Cron /cobrancas]', resultados)

    return NextResponse.json({
      success: true,
      executadoEm: agora.toISOString(),
      ...resultados,
    })
  } catch (err) {
    console.error('[Cron /cobrancas] Erro geral:', err)
    return NextResponse.json(
      { success: false, error: 'Erro interno no cron' },
      { status: 500 },
    )
  }
}
