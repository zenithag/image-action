import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type SectionHeadingProps = {
  eyebrow: string
  title: string
  description: string
  align?: "left" | "center"
}

export function SectionHeading({ eyebrow, title, description, align = "left" }: SectionHeadingProps) {
  return (
    <div className={cn("space-y-3", align === "center" && "text-center")}>
      <Badge variant="outline" className="border-border bg-card text-muted-foreground">
        {eyebrow}
      </Badge>
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold leading-none tracking-[-0.04em] text-foreground md:text-[40px]">{title}</h2>
        <p className="max-w-2xl text-sm leading-7 text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}
