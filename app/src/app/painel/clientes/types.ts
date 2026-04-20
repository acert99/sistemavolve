import type { Cliente, FollowUpJob, Lead, LeadTimelineItem } from '@/types'

export type LeadListItem = Lead & {
  _count?: {
    timeline?: number
    followUpJobs?: number
    propostas?: number
  }
  client?: Cliente | null
}

export type LeadDetail = Lead & {
  timeline: Array<
    LeadTimelineItem & {
      creator?: {
        id: string
        nome: string
        email: string
      } | null
    }
  >
  followUpJobs: FollowUpJob[]
  propostas: Array<{
    id: string
    titulo: string
    status: string
    token: string
    createdAt: string
    valorTotal?: number | string
  }>
  client?: Cliente | null
}

export type LeadAlertsResponse = {
  hotLeads: LeadListItem[]
  overdueActions: LeadListItem[]
  proposalWaiting: LeadListItem[]
  failedJobs: Array<
    FollowUpJob & {
      lead: {
        id: string
        name: string
        stage: string
        phone: string
      }
    }
  >
}
