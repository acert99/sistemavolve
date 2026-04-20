import type { Metadata } from 'next'
import { EmptyState } from '@/components/panel/empty-state'
import { MetricCard } from '@/components/panel/metric-card'
import { PageHeader } from '@/components/panel/page-header'
import {
  ApprovalIcon,
  CalendarIcon,
  LinkIcon,
  TasksIcon,
} from '@/components/panel/icons'
import { DEFAULT_PORTFOLIO, TASK_GROUP_META, TASK_GROUP_ORDER } from '@/app/painel/tarefas/constants'
import { FilaAtencao } from '@/app/painel/tarefas/components/FilaAtencao'
import type {
  ClientListOption,
  PortfolioKey,
  PortfolioOption,
  TaskCardView,
  TaskGroupView,
} from '@/app/painel/tarefas/types'
import {
  classificarTarefas,
  getActiveTasks,
  getEmbedViewUrl,
  getFolderLists,
  getPortfolioFolders,
} from '@/lib/clickup'
import { formatDateTimeInAppTimeZone } from '@/lib/timezone'
import { isSexta, labelAmanha } from '@/lib/utils/dates'

export const metadata: Metadata = { title: 'Tarefas' }
export const dynamic = 'force-dynamic'

function readSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? '' : value ?? ''
}

function parsePortfolio(value: string): PortfolioKey {
  if (value === 'volve') return 'volve'
  if (value === 'volve-health') return 'volve-health'
  return DEFAULT_PORTFOLIO
}

function buildTaskGroups(tasks: TaskCardView[], tomorrowLabel: string): TaskGroupView[] {
  return TASK_GROUP_ORDER.flatMap((groupId) => {
    const items = tasks.filter((task) => task.groupId === groupId)
    if (items.length === 0) return []

    const meta = TASK_GROUP_META[groupId]

    return [
      {
        id: groupId,
        title: groupId === 'amanha' ? tomorrowLabel : meta.title,
        description: meta.description,
        tone: meta.tone,
        badgeText: meta.badgeText,
        collapsedByDefault: meta.collapsedByDefault,
        items,
      },
    ]
  })
}

function buildClientOptions(
  listsByPortfolio: Array<{
    portfolio: Awaited<ReturnType<typeof getPortfolioFolders>>[number]
    lists: Awaited<ReturnType<typeof getFolderLists>>
  }>,
): ClientListOption[] {
  return listsByPortfolio
    .flatMap(({ portfolio, lists }) =>
      lists.map((list) => ({
        id: list.id,
        name: list.name,
        taskCount: 0,
        portfolioKey: portfolio.key,
        portfolioLabel: portfolio.label,
      })),
    )
    .sort((left, right) => {
      const nameCompare = left.name.localeCompare(right.name, 'pt-BR')
      if (nameCompare !== 0) return nameCompare

      return left.portfolioLabel.localeCompare(right.portfolioLabel, 'pt-BR')
    })
}

export default async function TarefasPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>
}) {
  const clickUpConfigured = Boolean(
    (process.env.CLICKUP_API_TOKEN ?? process.env.CLICKUP_API_KEY) &&
      process.env.CLICKUP_TEAM_ID,
  )

  if (!clickUpConfigured) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Operacao"
          title="Modulo de Tarefas"
          description="A nova fila de atencao depende da configuracao minima do ClickUp para buscar tasks em tempo real e classificar a urgencia no servidor."
          meta={[{ label: 'ClickUp pendente', tone: 'warning' }]}
        />

        <EmptyState
          icon={<TasksIcon className="h-6 w-6" />}
          title="ClickUp ainda nao configurado"
          description="Defina pelo menos CLICKUP_API_TOKEN ou CLICKUP_API_KEY e CLICKUP_TEAM_ID para liberar a fila de atencao. Os IDs de space e folders podem ser descobertos automaticamente pelo app."
        />
      </div>
    )
  }

  const selectedPortfolio = parsePortfolio(readSearchParam(searchParams?.carteira))
  const requestedClientId = readSearchParam(searchParams?.cliente) || null
  const portfolioFolders = await getPortfolioFolders()

  if (portfolioFolders.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Operacao"
          title="Modulo de Tarefas"
          description="A conexao com o ClickUp esta ativa, mas o app nao conseguiu localizar as carteiras do space WORKFLOW para montar a fila."
          meta={[{ label: 'Estrutura nao encontrada', tone: 'danger' }]}
        />

        <EmptyState
          icon={<TasksIcon className="h-6 w-6" />}
          title="Carteiras do ClickUp nao encontradas"
          description="Confirme o space WORKFLOW e, se necessario, informe CLICKUP_SPACE_ID, CLICKUP_FOLDER_ID_VOLVE e CLICKUP_FOLDER_ID_VOLVE_HEALTH no ambiente."
        />
      </div>
    )
  }

  const listsByPortfolio = await Promise.all(
    portfolioFolders.map(async (portfolio) => ({
      portfolio,
      lists: await getFolderLists(portfolio.folderId),
    })),
  )

  const visiblePortfolios =
    selectedPortfolio === 'all'
      ? portfolioFolders
      : portfolioFolders.filter((portfolio) => portfolio.key === selectedPortfolio)

  const clientOptions = buildClientOptions(
    listsByPortfolio.filter(
      ({ portfolio }) => selectedPortfolio === 'all' || portfolio.key === selectedPortfolio,
    ),
  )
  const selectedClient =
    clientOptions.find((client) => client.id === requestedClientId) ?? null
  const selectedClientId = selectedClient?.id ?? null

  const taskSets = selectedClient
    ? await Promise.all(
        visiblePortfolios
          .filter((portfolio) => portfolio.key === selectedClient.portfolioKey)
          .map((portfolio) =>
            getActiveTasks({
              folderId: portfolio.folderId,
              listId: selectedClient.id,
            }),
          ),
      )
    : await Promise.all(
        visiblePortfolios.map((portfolio) =>
          getActiveTasks({
            folderId: portfolio.folderId,
          }),
        ),
      )

  const tasks = taskSets.flat()

  const friday = isSexta(new Date())
  const tomorrowLabel = labelAmanha(new Date())
  const classifiedTasks = classificarTarefas(tasks).map<TaskCardView>((task) => ({
    ...task,
  }))
  const groups = buildTaskGroups(classifiedTasks, tomorrowLabel)

  const portfolioOptions: PortfolioOption[] = [
    { key: 'all', label: 'Toda Operacao' },
    ...portfolioFolders.map((portfolio) => ({
      key: portfolio.key,
      label: portfolio.label,
    })),
  ]

  const selectedPortfolioLabel =
    selectedPortfolio === 'all'
      ? 'Toda Operacao'
      : portfolioFolders.find((portfolio) => portfolio.key === selectedPortfolio)?.label ??
        'Toda Operacao'

  const selectedEmbedViews =
    selectedPortfolio === 'all'
      ? portfolioFolders.map((portfolio) => ({
          key: portfolio.key,
          label: portfolio.label,
          url: getEmbedViewUrl(portfolio.key),
        }))
      : visiblePortfolios.map((portfolio) => ({
          key: portfolio.key,
          label: portfolio.label,
          url: getEmbedViewUrl(portfolio.key),
        }))

  const attentionNow =
    classifiedTasks.filter((task) =>
      task.groupId === 'enviar_cliente' ||
      task.groupId === 'atrasado' ||
      task.groupId === 'hoje',
    ).length
  const noDeadline = classifiedTasks.filter((task) => task.groupId === 'sem_prazo').length
  const blocked = classifiedTasks.filter((task) => task.groupId === 'bloqueado').length
  const readyToSend = classifiedTasks.filter((task) => task.groupId === 'aprovado').length

  const warnings = [
    friday
      ? 'Na sexta-feira, o agrupamento do proximo dia util passa a apontar para segunda-feira.'
      : null,
    selectedEmbedViews.some((view) => !view.url)
      ? selectedPortfolio === 'all'
        ? 'A aba Quadro exibe uma view por vertical e entra em modo completo assim que as URLs publicas do ClickUp forem configuradas para todas elas.'
        : 'A aba Quadro entra em modo completo assim que a view publica do ClickUp for configurada no ambiente.'
      : null,
  ].filter(Boolean) as string[]

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operacao"
        title="Fila de Atencao"
        description="A tela de tarefas agora responde ao que pede acao imediata na operacao. O ClickUp continua sendo a fonte de verdade, e a classificacao por prazo e urgencia acontece no servidor."
        meta={[
          { label: `${classifiedTasks.length} task(s) visivel(is)` },
          { label: selectedPortfolioLabel },
          { label: 'ClickUp em tempo real', tone: 'success' },
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-4">
        <MetricCard
          label="Tasks ativas"
          value={classifiedTasks.length}
          hint="Cards puxados direto do ClickUp para os filtros atuais."
          tone="volve"
          icon={<TasksIcon className="h-5 w-5" />}
        />
        <MetricCard
          label="Acao imediata"
          value={attentionNow}
          hint="Aprovacao, atraso ou prazo no dia util atual."
          tone={attentionNow > 0 ? 'warning' : 'success'}
          icon={<ApprovalIcon className="h-5 w-5" />}
        />
        <MetricCard
          label="Sem prazo"
          value={noDeadline}
          hint="Itens que pedem data para nao sumirem no backlog."
          tone={noDeadline > 0 ? 'warning' : 'neutral'}
          icon={<CalendarIcon className="h-5 w-5" />}
        />
        <MetricCard
          label="Prontas para cliente"
          value={readyToSend}
          hint={`${blocked} bloqueada(s) aguardando material.`}
          tone={readyToSend > 0 ? 'neutral' : 'success'}
          icon={<LinkIcon className="h-5 w-5" />}
        />
      </div>

      <FilaAtencao
        groups={groups}
        portfolioOptions={portfolioOptions}
        clientOptions={clientOptions}
        selectedPortfolio={selectedPortfolio}
        selectedClientId={selectedClientId}
        isFriday={friday}
        updatedAtLabel={formatDateTimeInAppTimeZone(new Date())}
        embedViews={selectedEmbedViews}
        warnings={warnings}
      />
    </div>
  )
}
