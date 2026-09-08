import { ImageResponse } from "next/og"

// Guia, cap. 14.1: "Open Graph e imagem social específica por ICP". Gerada em
// código (sem foto de banco de imagens ou print de produto) — cartão de marca
// com azul/turquesa oficiais e o eyebrow/H1 real de cada página, sem inventar
// nenhum visual de produto que não existe.
export const ogImageSize = { width: 1200, height: 630 }
export const ogImageContentType = "image/png"

export function renderOgImage(eyebrow: string, title: string) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "88px",
          backgroundColor: "#00165A",
          backgroundImage: "radial-gradient(circle at 82% 12%, rgba(1,207,176,0.35), transparent 55%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ display: "flex", width: 16, height: 16, borderRadius: 999, backgroundColor: "#01CFB0" }} />
          <span style={{ fontSize: 28, fontWeight: 600, color: "#01CFB0", textTransform: "uppercase", letterSpacing: 4 }}>
            {eyebrow}
          </span>
        </div>
        <div style={{ display: "flex", marginTop: 32, fontSize: 60, fontWeight: 700, color: "#FFFFFF", lineHeight: 1.15, maxWidth: 980 }}>
          {title}
        </div>
        <div style={{ display: "flex", marginTop: 44, fontSize: 26, color: "rgba(255,255,255,0.6)" }}>comofica.ai</div>
      </div>
    ),
    { ...ogImageSize }
  )
}
