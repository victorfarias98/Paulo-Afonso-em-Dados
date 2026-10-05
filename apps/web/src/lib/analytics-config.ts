export function readAnalyticsConfig(
  env: Record<string, string | undefined>,
): { key: string; host: string } | null {
  if (env.POSTHOG_ENABLED === "false") return null;
  if ((env.NODE_ENV === "development" || env.NODE_ENV === "test") && env.POSTHOG_ENABLED !== "true")
    return null;
  const key = env.POSTHOG_PROJECT_TOKEN?.trim();
  if (!key || !/^(phc_|ph_project_)[A-Za-z0-9_-]{16,}$/.test(key)) return null;
  try {
    const url = new URL(env.POSTHOG_HOST || "https://us.i.posthog.com");
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/"
    )
      return null;
    return { key, host: url.origin };
  } catch {
    return null;
  }
}
