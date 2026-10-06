import { getTenantCatalogAccess } from "@/lib/server/tenant-catalog-access"
import Link from "next/link"
import { notFound } from "next/navigation"
import type { CSSProperties } from "react"

import { PublicProductActions } from "@/components/public-product-actions"
import { SafeImage } from "@/components/safe-image"
import { listCatalogItems } from "@/lib/server/catalog-store"
import { readTenantInstances } from "@/lib/server/tenant-channel-instances-store"
import { getTenantSettings } from "@/lib/server/tenant-settings-store"
import { findTenant } from "@/lib/server/tenants-store"

type PageProps = {
  params: Promise<{
    slug: string
    id: string
  }>
}

function getCatalogImageUrl(slug: string, itemId: string) {
  return `/api/tenant/${encodeURIComponent(slug)}/catalog/items/${encodeURIComponent(itemId)}/image`
}

function normalizeWhatsAppNumber(value?: string) {
  const digits = value?.replace(/\D/g, "") ?? ""

  return digits.length >= 10 ? digits : undefined
}

function getTagEntries(tags: Record<string, string>) {
  return Object.entries(tags).filter(([, value]) => value.trim())
}

export default async function PublicCatalogProductPage({ params }: PageProps) {
  const { slug, id } = await params
  const tenant = await findTenant(slug)

  if (!tenant || tenant.status !== "active" || !(await getTenantCatalogAccess(slug)).enabled) {
    notFound()
  }

  const [settings, catalogItems, instances] = await Promise.all([
    getTenantSettings(tenant.slug),
    listCatalogItems(tenant.slug),
    readTenantInstances(),
  ])
  const item = catalogItems.find((catalogItem) => catalogItem.id === id && catalogItem.status === "active")

  if (!item) {
    notFound()
  }

  const primaryColor = settings.branding.primaryColor || "#12849a"
  const companyName = settings.general.companyName.trim() || tenant.name
  const publicWhatsAppNumber = normalizeWhatsAppNumber(
    instances.find((instance) =>
      instance.tenantSlug === tenant.slug &&
      instance.channel === "whatsapp" &&
      instance.connected &&
      instance.phoneNumber
    )?.phoneNumber ?? tenant.phone
  )
  const tagEntries = getTagEntries(item.tags)

  return (
    <main
      className="min-h-screen bg-slate-50 px-4 py-4 text-slate-950 sm:px-6 lg:px-10"
      style={{
        "--catalog-accent": primaryColor,
        backgroundImage:
          "linear-gradient(rgba(15, 23, 42, 0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(15, 23, 42, 0.035) 1px, transparent 1px)",
        backgroundSize: "64px 64px",
      } as CSSProperties}
    >
      <div className="mx-auto max-w-7xl">
        <header className="mb-5 flex flex-col gap-3 rounded-[1.5rem] border border-slate-200 bg-white/92 p-3 shadow-sm backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-2xl bg-[color:var(--catalog-accent)] text-lg font-black text-white shadow-sm">
              C
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--catalog-accent)]">
                ComoFica Store
              </p>
              <p className="text-sm font-semibold text-slate-700">Catálogo {companyName}</p>
            </div>
          </div>
          <Link
            href={`/catalogo/${encodeURIComponent(tenant.slug)}`}
            className="inline-flex justify-center rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-600 transition hover:text-[color:var(--catalog-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--catalog-accent)]"
          >
            Voltar ao catálogo
          </Link>
        </header>

        <section className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.72fr)]">
          <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-3 shadow-sm">
            <div
              className="flex min-h-[440px] items-center justify-center overflow-hidden rounded-[1.5rem] bg-slate-100 lg:min-h-[720px]"
              style={{
                background: `radial-gradient(circle at 18% 16%, ${primaryColor}18, transparent 34%), linear-gradient(135deg, #f8fafc 0%, #eef2f7 100%)`,
              }}
            >
              <SafeImage
                src={getCatalogImageUrl(tenant.slug, item.id)}
                alt={item.name}
                className="h-full max-h-[760px] w-full object-contain object-center"
                fallbackClassName="min-h-[440px] lg:min-h-[720px]"
                fallbackLabel="Imagem do produto indisponível"
                fallbackHint="Use o SKU para solicitar este item no WhatsApp."
              />
            </div>
          </div>

          <aside className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm backdrop-blur lg:sticky lg:top-5">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--catalog-accent)]">
              {item.category}
            </p>
            <h1 className="mt-3 font-display text-4xl font-black leading-none tracking-[-0.06em] sm:text-5xl">
              {item.name}
            </h1>
            <p className="mt-3 text-sm text-slate-500">
              Catálogo {companyName}
            </p>

            {item.sku && (
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">SKU</p>
                <p className="mt-1 break-all font-mono text-xs font-bold text-slate-800">{item.sku}</p>
              </div>
            )}

            {item.description && (
              <p className="mt-5 text-base leading-7 text-slate-600">
                {item.description}
              </p>
            )}

            {tagEntries.length > 0 && (
              <div className="mt-6 border-t border-slate-200 pt-5">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Atributos</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {tagEntries.map(([key, value]) => (
                    <span
                      key={`${key}-${value}`}
                      className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600"
                    >
                      <strong>{key}</strong>: {value}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 border-t border-slate-200 pt-5">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                Usar este produto
              </p>
              <PublicProductActions
                productName={item.name}
                sku={item.sku}
                whatsappNumber={publicWhatsAppNumber}
                primaryColor={primaryColor}
              />
            </div>
          </aside>
        </section>
      </div>
    </main>
  )
}
