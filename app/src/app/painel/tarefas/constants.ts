import type { GroupTone, TaskGroupId } from '@/app/painel/tarefas/types'

export const DEFAULT_PORTFOLIO = 'all' as const

export const TASK_GROUP_ORDER: TaskGroupId[] = [
  'enviar_cliente',
  'atrasado',
  'hoje',
  'amanha',
  'esta_semana',
  'sem_prazo',
  'bloqueado',
  'aprovado',
  'proximas_semanas',
  'outros',
]

export const TASK_GROUP_META: Record<
  TaskGroupId,
  {
    title: string
    description: string
    tone: GroupTone
    badgeText?: string
    collapsedByDefault?: boolean
  }
> = {
  enviar_cliente: {
    title: 'Aguardando aprovacao',
    description: 'Itens prontos para envio ou retorno imediato do cliente.',
    tone: 'purple',
  },
  atrasado: {
    title: 'Em atraso',
    description: 'Cards ativos cujo prazo ja venceu e pedem replanejamento agora.',
    tone: 'danger',
  },
  hoje: {
    title: 'Hoje',
    description: 'Tarefas que vencem no dia util atual.',
    tone: 'warning',
  },
  amanha: {
    title: 'Amanha',
    description: 'Proximo dia util da fila para organizar antes de travar a equipe.',
    tone: 'warning',
  },
  esta_semana: {
    title: 'Esta semana',
    description: 'Janela curta de execucao com prazo entre dois e cinco dias uteis.',
    tone: 'info',
  },
  sem_prazo: {
    title: 'Sem prazo definido',
    description: 'Tarefas ativas que precisam de data para nao sumirem no fluxo.',
    tone: 'neutral',
    badgeText: 'atencao',
  },
  bloqueado: {
    title: 'Bloqueado',
    description: 'Dependem de materiais ou retorno do cliente para continuar.',
    tone: 'blocked',
    badgeText: 'aguardando',
  },
  aprovado: {
    title: 'Pronto para publicar',
    description: 'Itens aprovados dentro do ClickUp e prontos para a proxima etapa.',
    tone: 'success',
  },
  proximas_semanas: {
    title: 'Proximas semanas',
    description: 'Fila fria, sem urgencia imediata, mantida colapsada por padrao.',
    tone: 'neutral',
    collapsedByDefault: true,
  },
  outros: {
    title: 'Outros',
    description: 'Fallback para status nao mapeados ou payloads fora do esperado.',
    tone: 'neutral',
    collapsedByDefault: true,
  },
}
