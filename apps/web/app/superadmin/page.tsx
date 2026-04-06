import type { Tenant } from "@studio/contracts"

import { SuperadminDashboard } from "@/components/organisms/superadmin-dashboard"

const tenants: Tenant[] = [
  { id: "tenant-1", name: "Decor Labs", slug: "decor-labs", status: "active", plan_code: "growth" },
  { id: "tenant-2", name: "Moda Urbana", slug: "moda-urbana", status: "active", plan_code: "scale" },
  { id: "tenant-3", name: "Casa Atelier", slug: "casa-atelier", status: "draft", plan_code: "pilot" },
]

export default function SuperadminPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-10">
        <SuperadminDashboard tenants={tenants} />
      </div>
    </main>
  )
}
