"use client";

import { CaretDownIcon, ListIcon, XIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const PRIMARY_LINKS = [
  { href: "/", label: "Início" },
  { href: "/novidades", label: "Novidades" },
  { href: "/obras", label: "Obras" },
  { href: "/gastos", label: "Gastos" },
  { href: "/contratos", label: "Contratos" },
] as const;

const SUPPORT_LINKS = [
  { href: "/licitacoes", label: "Licitações" },
  { href: "/fornecedores", label: "Quem recebe" },
  { href: "/entenda", label: "Entenda os dados" },
  { href: "/fontes", label: "Fontes oficiais" },
] as const;

const isCurrent = (pathname: string, href: string): boolean =>
  href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

/**
 * Seções do portal. No celular abre um painel vertical com alvos grandes e
 * fechamento explícito; em telas largas fica na mesma linha do cabeçalho.
 */
export function SiteNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const supportIsCurrent = SUPPORT_LINKS.some(({ href }) => isCurrent(pathname, href));
  const menuButton = useRef<HTMLButtonElement>(null);
  const firstLink = useRef<HTMLAnchorElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const moreMenu = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1280px)");
    const closeAtDesktop = ({ matches }: MediaQueryListEvent) => {
      if (matches) setOpen(false);
    };
    desktop.addEventListener("change", closeAtDesktop);
    return () => desktop.removeEventListener("change", closeAtDesktop);
  }, []);

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
          <span>{open ? "Fechar" : "Menu"}</span>
        </span>
      </button>

      <div
        id="mobile-navigation"
        className={`mobile-navigation ${open ? "is-open" : ""}`}
        aria-hidden={!open}
        inert={!open}
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
          <div className="mobile-navigation-heading">
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-[0.14em] text-azul-forte uppercase">
                Explore o portal
              </p>
              <p id="mobile-navigation-title" className="mt-1 text-xl font-semibold">
                O que você quer acompanhar?
              </p>
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
          <p className="mobile-navigation-group-label">Acompanhar</p>
          <ul className="mobile-navigation-list">
            {PRIMARY_LINKS.map(({ href, label }, index) => {
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
          <p className="mobile-navigation-group-label">Entender e conferir</p>
          <ul className="mobile-navigation-list mobile-navigation-list-secondary">
            {SUPPORT_LINKS.map(({ href, label }) => {
              const current = isCurrent(pathname, href);
              return (
                <li key={href}>
                  <Link
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
        {PRIMARY_LINKS.map(({ href, label }) => {
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
        <li className="desktop-navigation-more">
          <details ref={moreMenu}>
            <summary className={supportIsCurrent ? "is-current" : undefined}>
              Mais <CaretDownIcon size={16} aria-hidden="true" />
            </summary>
            <ul>
              {SUPPORT_LINKS.map(({ href, label }) => {
                const current = isCurrent(pathname, href);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={current ? "page" : undefined}
                      onClick={() => moreMenu.current?.removeAttribute("open")}
                    >
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </details>
        </li>
      </ul>
    </nav>
  );
}
