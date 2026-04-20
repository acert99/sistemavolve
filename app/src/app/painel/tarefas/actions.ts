'use server'

import { revalidatePath } from 'next/cache'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { invalidateClickUpTaskCaches, updateTaskStatus } from '@/lib/clickup'

async function requireEquipeSession() {
  const session = await getServerSession(authOptions)

  if (!session || session.user.perfil !== 'equipe') {
    throw new Error('Nao autorizado')
  }
}

function resolveActionError(error: unknown, fallbackMessage: string) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallbackMessage
}

export async function refreshClickUpTasksAction() {
  try {
    await requireEquipeSession()
    await invalidateClickUpTaskCaches()
    revalidatePath('/painel/tarefas')

    return { success: true as const }
  } catch (error) {
    return {
      success: false as const,
      error: resolveActionError(error, 'Nao foi possivel atualizar a fila agora.'),
    }
  }
}

export async function sendTaskToApprovalAction(taskId: string) {
  try {
    await requireEquipeSession()

    if (!taskId) {
      return {
        success: false as const,
        error: 'Task invalida para envio ao cliente.',
      }
    }

    await updateTaskStatus(taskId, 'enviar para o cliente')
    await invalidateClickUpTaskCaches()
    revalidatePath('/painel/tarefas')

    return { success: true as const }
  } catch (error) {
    return {
      success: false as const,
      error: resolveActionError(error, 'Nao foi possivel mover a task para aprovacao.'),
    }
  }
}
