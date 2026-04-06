import { type LucideIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type ModuleCardProps = {
  icon: LucideIcon
  title: string
  summary: string
  tag: string
}

export function ModuleCard({ icon: Icon, title, summary, tag }: ModuleCardProps) {
  return (
    <Card className="group h-full border-border/70 transition-transform duration-300 hover:-translate-y-1">
      <CardHeader className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="rounded-2xl border border-border bg-background/70 p-3 text-primary">
            <Icon className="size-5" />
          </div>
          <Badge variant="secondary">{tag}</Badge>
        </div>
        <div className="space-y-2">
          <CardTitle className="font-display text-2xl leading-none tracking-[-0.03em]">{title}</CardTitle>
          <CardDescription>{summary}</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-px w-full bg-gradient-to-r from-primary/30 via-border to-transparent" />
      </CardContent>
    </Card>
  )
}
