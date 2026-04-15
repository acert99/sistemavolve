// =============================================================================
// Link público de proposta — /propostas/[token]
// Acessível sem login. Marca como visualizada e permite aceitar/recusar.
// =============================================================================
import { notFound } from 'next/navigation'
import prisma from '@/lib/prisma'
import PropostaPublicaClient from './PropostaPublicaClient'
import type { Metadata } from 'next'

interface Props {
  params: { token: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const proposta = await prisma.proposta.findUnique({
    where: { token: params.token },
    select: { titulo: true },
  })

  return {
    title: proposta ? `${proposta.titulo} | Proposta Volve` : 'Proposta Volve',
    robots: 'noindex',  // Não indexar links de proposta
  }
}

export default async function PropostaPublicaPage({ params }: Props) {
  const proposta = await prisma.proposta.findUnique({
    where: { token: params.token },
    include: {
      cliente: { select: { nome: true, email: true } },
    },
  })

  if (!proposta) {
    notFound()
  }

  // Marca como visualizada se ainda estava como "enviada"
  if (proposta.status === 'enviada') {
    await prisma.proposta.update({
      where: { id: proposta.id },
      data: {
        status: 'visualizada',
        visualizadoEm: new Date(),
      },
    })
  }

  // Serializa para passar ao componente cliente
  const propostaSerial = {
    ...proposta,
    valorTotal: Number(proposta.valorTotal),
    createdAt: proposta.createdAt.toISOString(),
    updatedAt: proposta.updatedAt.toISOString(),
    validade: proposta.validade?.toISOString() ?? null,
    visualizadoEm: proposta.visualizadoEm?.toISOString() ?? null,
    aceitoEm: proposta.aceitoEm?.toISOString() ?? null,
    recusadoEm: proposta.recusadoEm?.toISOString() ?? null,
  }

  return <PropostaPublicaClient proposta={propostaSerial} />
}
