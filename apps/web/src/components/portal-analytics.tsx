"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import {
  analyticsReady,
  capturePortalEvent,
  initializeAnalytics,
  subscribeAnalytics,
} from "@/lib/analytics-client";
import type { readAnalyticsConfig } from "@/lib/analytics-config";
import { publicPath, sanitizeSearchTerm } from "@/lib/analytics-privacy";

function recordSubmittedForm(event: Event): void {
  if (!(event.target instanceof HTMLFormElement)) return;
  const form = event.target;
  const path = publicPath(new URL(form.action, window.location.origin).pathname);
  if (!path || form.method.toLowerCase() !== "get") return;
  const data = new FormData(form);
  const search = sanitizeSearchTerm(String(data.get("q") ?? ""));
  const fields = Object.fromEntries(
    [...data.entries()].filter(
      ([key, value]) =>
        key !== "q" && key !== "pagina" && typeof value === "string" && value !== "",
    ),
  );
  const section = path.split("/")[1] || "inicio";
  if (search.length > 0)
    capturePortalEvent("portal_search_submitted", {
      page_path: path,
      section,
      search_term: search.term,
      search_length: search.length,
      search_redacted: search.redacted,
    });
  if (Object.keys(fields).length > 0)
    capturePortalEvent("portal_filter_applied", {
      page_path: path,
      section,
      filter_names: Object.keys(fields),
      filters: fields,
    });
}

function recordLink(event: MouseEvent): void {
  const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
  if (!(anchor instanceof HTMLAnchorElement)) return;
  const url = new URL(anchor.href, window.location.origin);
  const pagePath = publicPath(window.location.pathname);
  if (!pagePath) return;
  if (anchor.hasAttribute("data-analytics-source")) {
    capturePortalEvent("portal_source_opened", {
      page_path: pagePath,
      source_host: url.hostname,
      section: pagePath.split("/")[1] || "inicio",
    });
    return;
  }
  if (url.origin !== window.location.origin || !publicPath(url.pathname)) return;
  const page = url.searchParams.get("pagina");
  if (page && /^\d{1,6}$/.test(page)) {
    capturePortalEvent("portal_pagination_used", {
      page_path: pagePath,
      section: url.pathname.split("/")[1],
      target_page: Number(page),
    });
    return;
  }
  const filters = Object.fromEntries(
    [...url.searchParams].filter(([key]) => !["q", "pagina"].includes(key)),
  );
  if (Object.keys(filters).length || anchor.hasAttribute("data-analytics-filter"))
    capturePortalEvent("portal_filter_applied", {
      page_path: pagePath,
      section: url.pathname.split("/")[1],
      filter_names: Object.keys(filters),
      filters,
    });
}

function recordExplanation(event: Event): void {
  if (!(event.target instanceof HTMLDetailsElement) || !event.target.open) return;
  const explanation = event.target.dataset.analyticsExplanation;
  if (explanation)
    capturePortalEvent("portal_explanation_opened", {
      page_path: window.location.pathname,
      explanation,
    });
}

export function PortalAnalytics({ config }: { config: ReturnType<typeof readAnalyticsConfig> }) {
  const pathname = usePathname();
  const params = useSearchParams().toString();
  const ready = useSyncExternalStore(subscribeAnalytics, analyticsReady, () => false);
  const sent = useRef("");
  const sectionViews = useRef(new Set<string>());
  useEffect(() => {
    void initializeAnalytics(config);
  }, [config, pathname]);
  useEffect(() => {
    if (!ready || !publicPath(pathname)) return;
    const identity = `${pathname}?${params}`;
    if (sent.current === identity) return;
    sent.current = identity;
    capturePortalEvent("$pageview", {
      page_path: pathname,
      $pathname: pathname,
      $current_url: window.location.origin + pathname,
      section: pathname.split("/")[1] || "inicio",
      $referrer: document.referrer,
    });
    const match = /^\/(obras|contratos|licitacoes|fornecedores)\/([a-f0-9-]{36})$/i.exec(pathname);
    if (match)
      capturePortalEvent("portal_record_opened", {
        page_path: pathname,
        record_type: match[1],
        record_id: match[2],
      });
  }, [ready, pathname, params]);
  useEffect(() => {
    if (!ready || !publicPath(pathname)) return;
    document.addEventListener("submit", recordSubmittedForm, true);
    document.addEventListener("click", recordLink, true);
    document.addEventListener("toggle", recordExplanation, true);
    return () => {
      document.removeEventListener("submit", recordSubmittedForm, true);
      document.removeEventListener("click", recordLink, true);
      document.removeEventListener("toggle", recordExplanation, true);
    };
  }, [ready, pathname]);
  useEffect(() => {
    if (!ready || pathname !== "/") return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries
          .filter((entry) => entry.isIntersecting)
          .forEach((entry) => {
            const section = entry.target.getAttribute("aria-labelledby");
            if (!section || sectionViews.current.has(section)) return;
            sectionViews.current = new Set([...sectionViews.current, section]);
            capturePortalEvent("portal_home_section_viewed", { page_path: "/", section });
          });
      },
      { threshold: 0.1 },
    );
    document
      .querySelectorAll("[data-story-section],section[aria-labelledby='acompanhar']")
      .forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [ready, pathname]);
  return null;
}
