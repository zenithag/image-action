import { ArrowUpRight } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type MetricCardProps = {
  label: string
  value: string
  hint: string
}

export function MetricCard({ label, value, hint }: MetricCardProps) {
  return (
    <Card className="relative overflow-hidden bg-card/80">
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <ArrowUpRight className="size-4 text-primary" />
      </CardHeader>
      <CardContent className="space-y-1">
        <p className="text-3xl font-semibold tracking-[-0.04em] text-foreground">{value}</p>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  )
}
