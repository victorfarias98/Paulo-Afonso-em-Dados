import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";

// O .env fica na raiz do monorepo; o Next só procura na pasta do app.
const rootEnvFile = fileURLToPath(new URL("../../.env", import.meta.url));
if (existsSync(rootEnvFile)) {
  process.loadEnvFile(rootEnvFile);
}

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ...(process.env.NODE_ENV === "production"
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  // Imagem enxuta para Docker/Coolify: copia só o servidor e as dependências rastreadas.
  output: "standalone",
  experimental: {
    useTypeScriptCli: false,
    webpackBuildWorker: false,
  },
  // Pacotes internos são consumidos como TypeScript-fonte.
  transpilePackages: ["@pad/database", "@pad/domain"],
  serverExternalPackages: ["postgres"],
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
