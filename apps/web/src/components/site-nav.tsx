"use client";

import { ListIcon, XIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const LINKS = [
  { href: "/", label: "Início" },
  { href: "/obras", label: "Obras" },
  { href: "/gastos", label: "Gastos" },
  { href: "/contratos", label: "Contratos" },
  { href: "/licitacoes", label: "Licitações" },
  { href: "/fornecedores", label: "Quem recebe" },
  { href: "/entenda", label: "Entenda" },
  { href: "/fontes", label: "Fontes" },
  { href: "/novidades", label: "Novidades" },
] as const;

const isCurrent = (pathname: string, href: string): boolean =>
  href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

/**
 * Seções do portal. No celular abre um painel vertical com alvos grandes e
 * fechamento explícito; em telas largas fica na mesma linha do cabeçalho.
 */
export function SiteNav() {
  const pathname = usePathname();
  const currentLabel = LINKS.find(({ href }) => isCurrent(pathname, href))?.label ?? "Menu";
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const firstLink = useRef<HTMLAnchorElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    firstLink.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        menuButton.current?.focus();
      }
      if (event.key !== "Tab" || !panel.current) return;
      const focusable = panel.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    menuButton.current?.focus();
  };

  return (
    <nav aria-label="Seções do portal" className="lg:mx-0">
      <button
        ref={menuButton}
        type="button"
        className="botao-mobile-menu"
        aria-expanded={open}
        aria-controls="mobile-navigation"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="flex items-center gap-2">
          {open ? (
            <XIcon size={23} aria-hidden="true" />
          ) : (
            <ListIcon size={23} aria-hidden="true" />
          )}
          <span>{open ? "Fechar menu" : "Explorar"}</span>
        </span>
        <span className="botao-mobile-menu-current">{currentLabel}</span>
      </button>

      <div
        id="mobile-navigation"
        className={`mobile-navigation ${open ? "is-open" : ""}`}
        aria-hidden={!open}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
      >
        <div
          ref={panel}
          className="mobile-navigation-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mobile-navigation-title"
        >
          <div className="flex items-center justify-between border-b border-linha pb-4">
            <div>
              <p id="mobile-navigation-title" className="text-sm font-medium text-azul-forte">
                Paulo Afonso em Dados
              </p>
              <p className="mt-1 text-sm text-suave">Escolha para onde ir</p>
            </div>
            <button
              type="button"
              className="mobile-navigation-close"
              aria-label="Fechar menu"
              onClick={close}
            >
              <XIcon size={24} aria-hidden="true" />
            </button>
          </div>
          <ul className="mobile-navigation-list">
            {LINKS.map(({ href, label }, index) => {
              const current = isCurrent(pathname, href);
              return (
                <li key={href}>
                  <Link
                    ref={index === 0 ? firstLink : undefined}
                    href={href}
                    aria-current={current ? "page" : undefined}
                    onClick={close}
                    className={`mobile-navigation-link ${current ? "is-current" : ""}`}
                  >
                    <span>{label}</span>
                    <span aria-hidden="true">→</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <ul className="desktop-navigation-list">
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
