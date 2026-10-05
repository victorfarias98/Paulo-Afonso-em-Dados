"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { analyticsReady, capturePortalEvent, subscribeAnalytics } from "@/lib/analytics-client";
import { sanitizeSearchTerm } from "@/lib/analytics-privacy";

export function AnalyticsResults({
  section,
  query = "",
  count,
  categories = [],
}: {
  section: string;
  query?: string | undefined;
  count: number;
  categories?: string[];
}) {
  const ready = useSyncExternalStore(subscribeAnalytics, analyticsReady, () => false);
  const pathname = usePathname();
  const params = useSearchParams().toString();
  const sent = useRef("");
  const categoryKey = categories.join(",");
  useEffect(() => {
    if (!ready || !query.trim()) return;
    const identity = `${pathname}?${params}:${section}:${count}`;
    if (sent.current === identity) return;
    sent.current = identity;
    const search = sanitizeSearchTerm(query);
    capturePortalEvent("portal_search_results_viewed", {
      page_path: pathname,
      section,
      search_term: search.term,
      search_length: search.length,
      search_redacted: search.redacted,
      results_count: count,
      result_categories: categoryKey.split(",").filter(Boolean),
    });
  }, [ready, pathname, params, section, query, count, categoryKey]);
  return null;
}
