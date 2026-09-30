import { Separator } from "@/components/ui/separator"

interface PageHeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-1">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-[28px] font-semibold tracking-[-0.025em] text-foreground leading-tight">
          {title}
        </h1>
        {description ? (
          <p className="text-sm text-muted-foreground/85">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2.5 shrink-0">{actions}</div> : null}
    </div>
  )
}
