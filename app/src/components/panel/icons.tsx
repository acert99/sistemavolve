import type { ReactNode, SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

function IconBase({ children, className, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...props}
    >
      {children}
    </svg>
  )
}

export function DashboardIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 13h7V4H4z" />
      <path d="M13 20h7v-5h-7z" />
      <path d="M13 11h7V4h-7z" />
      <path d="M4 20h7v-5H4z" />
    </IconBase>
  )
}

export function ClientsIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
      <circle cx="9.5" cy="7" r="4" />
      <path d="M20 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16.5 3.2a4 4 0 0 1 0 7.6" />
    </IconBase>
  )
}

export function CommercialIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 20h16" />
      <path d="M7 16V9" />
      <path d="M12 16V5" />
      <path d="M17 16v-3" />
    </IconBase>
  )
}

export function TasksIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="3" y="4" width="6" height="6" rx="1.5" />
      <rect x="3" y="14" width="6" height="6" rx="1.5" />
      <rect x="13" y="4" width="8" height="6" rx="1.5" />
      <rect x="13" y="14" width="8" height="6" rx="1.5" />
    </IconBase>
  )
}

export function CommunicationIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 18.5V6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7A2.5 2.5 0 0 1 17.5 16H8z" />
      <path d="m8 16-4 4v-1.5" />
      <path d="M8 9h8" />
      <path d="M8 12h5" />
    </IconBase>
  )
}

export function ApprovalIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m9 12 2 2 4-4" />
      <circle cx="12" cy="12" r="9" />
    </IconBase>
  )
}

export function ProposalIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M14 3H6a2 2 0 0 0-2 2v14l4-3h8a2 2 0 0 0 2-2V7z" />
      <path d="M14 3v4h4" />
      <path d="M8 10h8" />
      <path d="M8 13h6" />
    </IconBase>
  )
}

export function ContractIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
      <path d="M14 3v5h5" />
      <path d="M8 13h8" />
      <path d="M8 17h5" />
    </IconBase>
  )
}

export function BillingIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 2v20" />
      <path d="M17 5.5a4.5 4.5 0 0 0-4.5-2.5c-2.3 0-4.2 1.2-4.2 3.5 0 5 8.7 2.6 8.7 7 0 2-1.7 3.5-4.5 3.5A5.6 5.6 0 0 1 7 14.5" />
    </IconBase>
  )
}

export function ServiceIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M5 8.5h14" />
      <path d="M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
      <path d="M9 12h6" />
      <path d="M9 16h4" />
    </IconBase>
  )
}

export function MenuIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </IconBase>
  )
}

export function LogoutIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </IconBase>
  )
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </IconBase>
  )
}

export function SparkIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m12 3 1.7 4.8L18.5 9.5l-4.8 1.7L12 16l-1.7-4.8L5.5 9.5l4.8-1.7z" />
      <path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" />
    </IconBase>
  )
}

export function CalendarIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4" />
      <path d="M8 3v4" />
      <path d="M3 11h18" />
    </IconBase>
  )
}

export function LinkIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M10 13a5 5 0 0 0 7.07 0l1.41-1.41a5 5 0 0 0-7.07-7.07L10 5" />
      <path d="M14 11a5 5 0 0 0-7.07 0L5.5 12.41a5 5 0 0 0 7.07 7.07L14 19" />
    </IconBase>
  )
}

export function WhatsAppIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M20 11.5A8.5 8.5 0 0 1 7.5 19L3 20l1.1-4.3A8.5 8.5 0 1 1 20 11.5z" />
      <path d="M9 9.5c.2-.4.4-.4.8-.4.2 0 .5 0 .7.6.2.5.7 1.7.8 1.8.1.1.1.3 0 .5-.1.2-.2.3-.4.5-.2.2-.3.4-.4.5-.1.1-.2.3 0 .6.2.3.8 1.4 1.8 2.3 1.2 1 2.2 1.3 2.5 1.5.3.1.5.1.7-.1.2-.2.8-.9 1-1.2.2-.3.4-.2.7-.1.3.1 1.8.8 2.1.9.3.2.5.2.5.3 0 .1 0 .9-.4 1.7-.4.7-2.2 1.6-2.9 1.6-.7 0-1.4 0-4.3-1.4-3.5-1.7-5.7-5.8-5.9-6.1-.1-.2-1.4-1.8-1.4-3.4 0-1.6.8-2.3 1.1-2.7z" />
    </IconBase>
  )
}
