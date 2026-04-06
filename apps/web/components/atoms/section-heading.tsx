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
    <div className={cn("space-y-4", align === "center" && "text-center")}>
      <Badge variant="outline" className="border-primary/20 bg-primary/6 text-primary">
        {eyebrow}
      </Badge>
      <div className="space-y-3">
        <h2 className="font-display text-3xl leading-none tracking-[-0.04em] text-foreground md:text-5xl">{title}</h2>
        <p className="max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">{description}</p>
      </div>
    </div>
  )
}
