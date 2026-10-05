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
        <header className="border-b border-linha bg-fundo xl:sticky xl:top-0 xl:z-40">
          <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-5 lg:h-16">
            <Link
              href="/"
              className="flex items-center gap-2.5 text-lg font-semibold tracking-tight"
            >
              <span className="marca" aria-hidden="true" />
              Paulo Afonso em Dados
            </Link>
            <div className="flex items-center gap-1">
              <div className="hidden xl:block">
                <SiteNav />
              </div>
              <Link
                href="/busca"
                aria-label="Buscar no portal"
                className="grid size-11 place-items-center rounded-full hover:bg-superficie"
              >
                <MagnifyingGlassIcon size={22} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </header>
        {/* No celular só a faixa de seções acompanha a rolagem; o nome do site fica no topo. */}
        <div className="sticky top-0 z-40 border-b border-linha bg-fundo px-5 pt-2 xl:hidden">
          <SiteNav />
        </div>

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
