import { PlatformOverview } from "@/components/organisms/platform-overview"
import Link from "next/link"

import { Button } from "@/components/ui/button"

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-6 md:px-8 md:py-10">
        <PlatformOverview />
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/superadmin">Abrir superadmin</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/tenant/decor-labs">Dashboard tenant</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/tenant/decor-labs/inbox">Abrir inbox</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/tenant/decor-labs/catalog">Abrir catalogo</Link>
          </Button>
        </div>
      </div>
    </main>
  )
}
