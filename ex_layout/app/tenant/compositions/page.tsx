import { AppSidebar } from "@/components/app-sidebar"
import { CompositionJobs } from "@/components/composition-jobs"

export default function CompositionsPage() {
  return (
    <div className="flex h-screen bg-background">
      <AppSidebar variant="tenant" />
      <div className="flex-1 overflow-hidden">
        <CompositionJobs />
      </div>
    </div>
  )
}
