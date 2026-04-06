import "./globals.css";
import type { Metadata } from "next";
import { ReactNode } from "react";
import { Fraunces, Inter } from "next/font/google";

import { ThemeProvider } from "@/components/theme-provider";

const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Atendimento Visual Multi-Tenant",
  description: "Plataforma conversacional multi-tenant para composicao visual por WhatsApp.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${fraunces.variable} ${inter.variable} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
