import { describe, expect, test } from "vitest";

import { authenticatedAdmin, isAuthorized, readAdminCredentials } from "./admin-auth";

const credentials = { user: "victor", password: "uma-senha-bem-longa" };
const basic = (user: string, password: string): string =>
  `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`;

describe("readAdminCredentials", () => {
  test("returns the credentials when both variables are set", () => {
    expect(
      readAdminCredentials({ ADMIN_USER: "victor", ADMIN_PASSWORD: "uma-senha-bem-longa" }),
    ).toEqual(credentials);
  });

  test("keeps the admin disabled when a variable is missing", () => {
    expect(readAdminCredentials({ ADMIN_USER: "victor" })).toBeNull();
    expect(readAdminCredentials({ ADMIN_PASSWORD: "uma-senha-bem-longa" })).toBeNull();
    expect(readAdminCredentials({})).toBeNull();
  });

  test("keeps the admin disabled when the password is too short", () => {
    expect(readAdminCredentials({ ADMIN_USER: "victor", ADMIN_PASSWORD: "curta" })).toBeNull();
  });
});

describe("isAuthorized", () => {
  test("accepts the right user and password", () => {
    expect(isAuthorized(basic("victor", "uma-senha-bem-longa"), credentials)).toBe(true);
  });

  test("accepts a password that contains a colon", () => {
    const withColon = { user: "victor", password: "senha:com:dois-pontos" };
    expect(isAuthorized(basic("victor", "senha:com:dois-pontos"), withColon)).toBe(true);
  });

  test("rejects a wrong password, a wrong user and a prefix of the password", () => {
    expect(isAuthorized(basic("victor", "errada-errada-errada"), credentials)).toBe(false);
    expect(isAuthorized(basic("outro", "uma-senha-bem-longa"), credentials)).toBe(false);
    expect(isAuthorized(basic("victor", "uma-senha"), credentials)).toBe(false);
  });

  test("rejects a missing or malformed header", () => {
    const noColon = `Basic ${Buffer.from("sem-dois-pontos").toString("base64")}`;

    expect(isAuthorized(null, credentials)).toBe(false);
    expect(isAuthorized("Bearer abc", credentials)).toBe(false);
    expect(isAuthorized("Basic !!!nao-base64!!!", credentials)).toBe(false);
    expect(isAuthorized(noColon, credentials)).toBe(false);
  });
});

describe("authenticatedAdmin", () => {
  const env = { ADMIN_USER: "victor", ADMIN_PASSWORD: "uma-senha-bem-longa" };

  test("returns the user name when the header carries the configured credentials", () => {
    expect(authenticatedAdmin(basic("victor", "uma-senha-bem-longa"), env)).toBe("victor");
  });

  test("returns null for a wrong password, a missing header or a disabled admin", () => {
    expect(authenticatedAdmin(basic("victor", "outra-senha-qualquer"), env)).toBeNull();
    expect(authenticatedAdmin(null, env)).toBeNull();
    expect(authenticatedAdmin(basic("victor", "uma-senha-bem-longa"), {})).toBeNull();
  });
});
