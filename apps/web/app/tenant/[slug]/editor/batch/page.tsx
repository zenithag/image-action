import { redirect } from "next/navigation"

export default async function BatchPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  redirect(`/tenant/${encodeURIComponent(slug)}/editor`)
}
