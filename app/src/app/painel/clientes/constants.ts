import type { LeadSource, LeadStage } from '@/types'

export const PIPELINE_STAGES: LeadStage[] = [
  'new',
  'contacted',
  'meeting',
  'proposal',
  'negotiation',
]

export const LEAD_STAGE_LABELS: Record<LeadStage, string> = {
  new: 'Novo lead',
  contacted: 'Primeiro contato',
  meeting: 'Reuniao agendada',
  proposal: 'Proposta enviada',
  negotiation: 'Negociacao',
  won: 'Fechado ganho',
  lost: 'Fechado perdido',
}

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  indicacao: 'Indicacao',
  instagram: 'Instagram',
  site: 'Site',
  outro: 'Outro',
}

export const LEAD_STAGE_BADGES: Record<LeadStage, string> = {
  new: 'badge-gray',
  contacted: 'badge-blue',
  meeting: 'badge-purple',
  proposal: 'badge-yellow',
  negotiation: 'badge-blue',
  won: 'badge-green',
  lost: 'badge-red',
}
