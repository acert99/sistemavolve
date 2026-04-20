export type PortfolioKey = 'all' | 'volve' | 'volve-health'

export type TaskGroupId =
  | 'enviar_cliente'
  | 'atrasado'
  | 'hoje'
  | 'amanha'
  | 'esta_semana'
  | 'sem_prazo'
  | 'bloqueado'
  | 'aprovado'
  | 'proximas_semanas'
  | 'outros'

export type GroupTone =
  | 'danger'
  | 'purple'
  | 'warning'
  | 'info'
  | 'neutral'
  | 'blocked'
  | 'success'

export interface PortfolioOption {
  key: PortfolioKey
  label: string
}

export interface ClientListOption {
  id: string
  name: string
  taskCount: number
  portfolioKey: Exclude<PortfolioKey, 'all'>
  portfolioLabel: string
}

export interface TaskAssigneeView {
  id: string
  name: string
  initials: string
  avatarUrl: string | null
}

export interface TaskTagView {
  name: string
  backgroundColor: string | null
  textColor: string | null
}

export interface TaskCardView {
  id: string
  name: string
  url: string
  groupId: TaskGroupId
  statusLabel: string
  statusColor: string | null
  dueDateLabel: string | null
  dueContextLabel: string
  priorityLabel: string | null
  priorityKey: 'urgent' | 'high' | 'normal' | 'low' | null
  clientName: string
  portfolioName: string
  assignees: TaskAssigneeView[]
  tags: TaskTagView[]
  returnsOnMonday: boolean
  canSendForApproval: boolean
  updatedAtLabel: string
}

export interface TaskGroupView {
  id: TaskGroupId
  title: string
  description: string
  tone: GroupTone
  badgeText?: string
  collapsedByDefault?: boolean
  items: TaskCardView[]
}
