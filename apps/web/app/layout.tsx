import "./globals.css";
import type { Metadata } from "next";
import { ReactNode } from "react";
import { Poppins, DM_Sans } from "next/font/google";

import { ThemeProvider } from "@/components/theme-provider";
import { SessionProvider } from "@/components/session-provider";

const poppins = Poppins({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://comofica.ai";
const siteName = "ComoFica.ai";
const siteTitle = "ComoFica.ai - Visualização comercial com inteligência artificial";
const siteDescription =
  "Transforme produtos, acabamentos e possibilidades em simulações visuais para o atendimento, o site e o WhatsApp da sua empresa.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  // Cada página define seu próprio título completo (já com "- ComoFica.ai"
  // no final, como no Guia de Estratégia do Site) — sem template automático
  // pra não duplicar o sufixo da marca.
  title: siteTitle,
  description: siteDescription,
  applicationName: siteName,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: siteUrl,
    siteName,
    title: siteTitle,
    description: siteDescription,
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${poppins.variable} ${dmSans.variable} antialiased font-sans`} suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <SessionProvider>{children}</SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
