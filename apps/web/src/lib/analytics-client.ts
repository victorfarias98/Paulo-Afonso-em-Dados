"use client";

import type { PostHog } from "posthog-js";

import type { readAnalyticsConfig } from "./analytics-config";
import { publicPath, sanitizeCapture } from "./analytics-privacy";

type Config = ReturnType<typeof readAnalyticsConfig>;
let client: PostHog | null = null;
let loading: Promise<void> | null = null;
let listeners: (() => void)[] = [];

export const analyticsReady = (): boolean => client !== null;
export function subscribeAnalytics(listener: () => void): () => void {
  listeners = [...listeners, listener];
  return () => {
    listeners = listeners.filter((item) => item !== listener);
  };
}

const trackingAllowed = (): boolean =>
  typeof window !== "undefined" &&
  navigator.doNotTrack !== "1" &&
  publicPath(window.location.pathname) !== null;

export function initializeAnalytics(config: Config): Promise<void> {
  if (!config || !trackingAllowed()) return Promise.resolve();
  if (loading) return loading;
  loading = import("posthog-js/no-external")
    .then(({ default: posthog }) => {
      if (!trackingAllowed()) return;
      posthog.init(config.key, {
        api_host: config.host,
        capture_pageview: false,
        capture_pageleave: false,
        autocapture: false,
        disable_session_recording: true,
        disable_surveys: true,
        disable_external_dependency_loading: true,
        advanced_disable_flags: true,
        capture_exceptions: false,
        person_profiles: "never",
        persistence: "sessionStorage",
        respect_dnt: true,
        ip: false,
        request_batching: false,
        before_send: (event) => {
          if (!event || !trackingAllowed()) return null;
          const clean = sanitizeCapture(event);
          if (!clean) return null;
          // The SDK requires the public project token in properties for ingestion.
          const { $set: _set, $set_once: _setOnce, $unset: _unset, ...envelope } = event;
          return {
            ...envelope,
            properties: {
              ...clean.properties,
              token: config.key,
              site: "paulo_afonso_em_dados",
              site_domain: window.location.hostname,
              $host: window.location.hostname,
              $process_person_profile: false,
              $geoip_disable: true,
            },
          };
        },
        loaded: () => {
          client = posthog;
          listeners.forEach((listener) => listener());
        },
      });
    })
    .catch(() => {
      // Telemetry is optional: a blocked SDK must never interrupt public queries.
      loading = null;
      window.dispatchEvent(new Event("portal:analytics-unavailable"));
    });
  return loading;
}

export function capturePortalEvent(event: string, properties: Record<string, unknown>): void {
  if (!client || !trackingAllowed()) return;
  const clean = sanitizeCapture({ event, properties });
  if (!clean) return;
  client.capture(
    clean.event,
    { ...clean.properties, site: "paulo_afonso_em_dados", site_domain: window.location.hostname },
    { send_instantly: true, transport: "sendBeacon" },
  );
}
