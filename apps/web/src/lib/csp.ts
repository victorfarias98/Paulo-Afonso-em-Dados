/**
 * Content-Security-Policy do portal. Scripts só rodam com o nonce da requisição;
 * conexões externas limitam-se ao host de analytics validado. Estilos em linha são permitidos porque
 * o Next os injeta sem nonce.
 */
function safeAnalyticsOrigin(host?: string | null): string | null {
  if (!host || host.trim() !== host || /[\s;"'\\]/.test(host)) return null;
  try {
    const url = new URL(host);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/"
    )
      return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function buildCsp(
  nonce: string,
  isDevelopment: boolean,
  analyticsHost?: string | null,
): string {
  const analyticsOrigin = safeAnalyticsOrigin(analyticsHost);
  // Em desenvolvimento o Next usa eval para o recarregamento de módulos.
  const scripts = `'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ""}`;
  const directives = [
    "default-src 'self'",
    `script-src ${scripts}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src 'self'${isDevelopment ? " ws:" : ""}${analyticsOrigin ? ` ${analyticsOrigin}` : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  return (isDevelopment ? directives : [...directives, "upgrade-insecure-requests"]).join("; ");
}
