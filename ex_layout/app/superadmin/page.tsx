import { AppSidebar } from "@/components/app-sidebar"
import { SuperadminTenants } from "@/components/superadmin-tenants"

export default function SuperadminPage() {
  return (
    <div className="flex h-screen bg-background">
      <AppSidebar variant="superadmin" />
      <div className="flex-1 overflow-hidden">
        <SuperadminTenants />
      </div>
    </div>
  )
}
