import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type ActivityRowProps = {
  title: string
  detail: string
  status: string
  tone?: "default" | "secondary" | "outline"
}

export function ActivityRow({ title, detail, status, tone = "outline" }: ActivityRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-border/80 bg-background/70 px-4 py-3">
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-sm leading-6 text-muted-foreground">{detail}</p>
      </div>
      <Badge variant={tone} className={cn("shrink-0")}>
        {status}
      </Badge>
    </div>
  )
}
