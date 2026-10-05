import { sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { checkReadiness } from "@/lib/health";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const readiness = await checkReadiness(() =>
    // LIMIT 0 checks relation existence and access without reading citizen data.
    getDb().execute(sql`SELECT 1 FROM payments, public_works, contracts LIMIT 0`),
  );

  return Response.json(readiness, {
    status: readiness.status === "ok" ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
