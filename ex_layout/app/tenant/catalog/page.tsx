import { AppSidebar } from "@/components/app-sidebar"
import { CatalogBrowser } from "@/components/catalog-browser"

export default function CatalogPage() {
  return (
    <div className="flex h-screen bg-background">
      <AppSidebar variant="tenant" />
      <div className="flex-1 overflow-hidden">
        <CatalogBrowser />
      </div>
    </div>
  )
}
