import { ArrowUpRight } from "@/components/spectrum/icons"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type MetricCardProps = {
  label: string
  value: string
  hint: string
}

export function MetricCard({ label, value, hint }: MetricCardProps) {
  return (
    <Card className="relative overflow-hidden border-border/80 bg-card/92">
      <CardHeader className="flex-row items-start justify-between space-y-0 pb-3">
        <CardTitle className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</CardTitle>
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted text-foreground/70">
          <ArrowUpRight className="size-4" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-[32px] font-semibold leading-none tracking-[-0.04em] text-foreground">{value}</p>
        <div className="border-t border-border/80 pt-3">
          <p className="text-sm text-muted-foreground">{hint}</p>
        </div>
      </CardContent>
    </Card>
  )
}
