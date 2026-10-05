import "./globals.css";

import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/ssr";
import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";

import { SiteNav } from "@/components/site-nav";
import { PortalAnalytics } from "@/components/portal-analytics";
import { readAnalyticsConfig } from "@/lib/analytics-config";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });

/**
 * Todas as páginas leem o banco, que muda a cada coleta: nada é gerado no
 * build. Isso também permite construir a imagem sem banco disponível.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Paulo Afonso em Dados", template: "%s — Paulo Afonso em Dados" },
  description:
    "Obras, contratos, licitações e gastos públicos de Paulo Afonso explicados de forma simples e com fonte oficial.",
  icons: { icon: "/brand/paulo-afonso-em-dados-mark.png" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4efe4" },
    { media: "(prefers-color-scheme: dark)", color: "#111b24" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={geist.variable}>
      <body className="flex min-h-dvh flex-col">
        <Suspense fallback={null}>
          <PortalAnalytics config={readAnalyticsConfig(process.env)} />
        </Suspense>
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-tinta focus:p-3 focus:text-fundo"
        >
          Ir para o conteúdo
        </a>
        <header className="site-header">
          <div className="site-header-inner">
            <Link href="/" className="site-brand" aria-label="Paulo Afonso em Dados — início">
              <span className="site-brand-mark" aria-hidden="true">
                <Image
                  src="/brand/paulo-afonso-em-dados-mark.png"
                  alt=""
                  width={384}
                  height={384}
                  priority
                />
              </span>
              <span className="site-brand-name">
                <span>Paulo Afonso</span>
                <span>em Dados</span>
              </span>
            </Link>
            <div className="site-header-actions">
              <SiteNav />
              <Link href="/busca" aria-label="Buscar no portal" className="site-header-search">
                <MagnifyingGlassIcon size={22} aria-hidden="true" />
                <span className="hidden 2xl:inline">Buscar</span>
              </Link>
            </div>
          </div>
        </header>

        <main id="conteudo" className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 sm:py-14">
          {children}
        </main>

        <footer className="border-t border-linha bg-superficie">
          <div className="mx-auto grid w-full max-w-6xl gap-8 px-5 py-10 text-sm text-suave md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <p className="max-w-prose">
                Projeto independente e apartidário. Reproduz dados publicados por órgãos oficiais e
                indica a fonte de cada um. Não é um canal oficial da Prefeitura nem da Câmara.
              </p>
              <p className="mt-3 flex flex-wrap gap-x-6 gap-y-1">
                <Link href="/fontes" className="link inline-flex min-h-11 items-center">
                  Fontes dos dados
                </Link>
                <a
                  href="mailto:contato@baiustecnologia.com.br"
                  className="link inline-flex min-h-11 items-center"
                >
                  Avisar sobre um erro
                </a>
              </p>
            </div>
            <a
              href="https://baiustecnologia.com.br"
              rel="noopener"
              className="flex items-center gap-3"
            >
              <span>Feito por</span>
              <Image
                src="/brand/baius-logo-blue.png"
                alt="Baius Tecnologia"
                width={1716}
                height={708}
                sizes="80px"
                className="h-7 w-[68px] dark:hidden"
              />
              <Image
                src="/brand/baius-logo-light.png"
                alt="Baius Tecnologia"
                width={1716}
                height={708}
                sizes="80px"
                className="hidden h-7 w-[68px] dark:block"
              />
            </a>
          </div>
        </footer>
      </body>
    </html>
  );
}
