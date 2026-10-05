import { describe, expect, test } from "vitest";

import { checkReadiness } from "./health";

describe("checkReadiness", () => {
  test("reports ready after the database and required tables can be queried", async () => {
    expect(await checkReadiness(async () => {})).toEqual({ status: "ok" });
  });

  test.each([
    "connection refused postgres://user:secret@host/db",
    'relation "public_works" does not exist',
    "DATABASE_URL is missing",
  ])("reports unavailable without exposing database failure: %s", async (message) => {
    const result = await checkReadiness(async () => {
      throw new Error(message);
    });
    expect(result).toEqual({ status: "unavailable" });
    expect(JSON.stringify(result)).not.toContain(message);
  });
});
