"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Início" },
  { href: "/obras", label: "Obras" },
  { href: "/gastos", label: "Gastos" },
  { href: "/contratos", label: "Contratos" },
  { href: "/licitacoes", label: "Licitações" },
  { href: "/fornecedores", label: "Quem recebe" },
  { href: "/entenda", label: "Entenda" },
  { href: "/fontes", label: "Fontes" },
] as const;

const isCurrent = (pathname: string, href: string): boolean =>
  href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

/**
 * Seções do portal. No celular é uma faixa que rola de lado, sempre à mão sob
 * o nome do site; em telas largas fica na mesma linha do cabeçalho.
 */
export function SiteNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Seções do portal" className="-mx-5 min-w-0 lg:mx-0">
      <ul className="faixa px-5 pb-2 lg:gap-1 lg:overflow-visible lg:px-0 lg:pb-0">
        {LINKS.map(({ href, label }) => {
          const current = isCurrent(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={current ? "page" : undefined}
                className={`inline-flex min-h-11 items-center rounded-full px-4 font-medium whitespace-nowrap transition-colors ${
                  current ? "bg-tinta text-fundo" : "hover:bg-superficie"
                }`}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
