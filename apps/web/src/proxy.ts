import { type NextRequest, NextResponse } from "next/server";

import { isAuthorized, readAdminCredentials } from "@/lib/admin-auth";
import { readAnalyticsConfig } from "@/lib/analytics-config";
import { buildCsp } from "@/lib/csp";

const CSP_HEADER = "Content-Security-Policy";

/**
 * Autenticação HTTP Basic da área administrativa. Sem credenciais configuradas
 * no ambiente, /admin responde 404, como se não existisse. Só é seguro atrás de
 * HTTPS, que o proxy de produção deve garantir. Devolve null quando pode seguir.
 */
function denyAdmin(request: NextRequest): NextResponse | null {
  const credentials = readAdminCredentials(process.env);
  if (!credentials) {
    return new NextResponse("Não encontrado", { status: 404 });
  }
  if (!isAuthorized(request.headers.get("authorization"), credentials)) {
    return new NextResponse("Autenticação necessária", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="Paulo Afonso em Dados - admin", charset="UTF-8"',
        "Cache-Control": "no-store",
      },
    });
  }
  return null;
}

const isAdminPath = (pathname: string): boolean =>
  pathname === "/admin" || pathname.startsWith("/admin/");

/** Protege o admin e aplica a política de segurança de conteúdo, com um nonce por requisição. */
export function proxy(request: NextRequest): NextResponse {
  if (isAdminPath(request.nextUrl.pathname)) {
    const denied = denyAdmin(request);
    if (denied) return denied;
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(
    nonce,
    process.env.NODE_ENV === "development",
    readAnalyticsConfig(process.env)?.host,
  );

  // O Next lê a política do cabeçalho do pedido para pôr o nonce nos seus scripts.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set(CSP_HEADER, csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set(CSP_HEADER, csp);
  return response;
}

export const config = {
  matcher: [
    // O admin é conferido em toda requisição, inclusive nas de pré-carregamento.
    "/admin",
    "/admin/:path*",
    {
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
