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
    <Card className="group h-full border-border transition-colors duration-200">
      <CardHeader className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="rounded border border-border bg-muted p-3 text-primary">
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
        <div className="h-px w-full border-t border-border" />
      </CardContent>
    </Card>
  )
}
