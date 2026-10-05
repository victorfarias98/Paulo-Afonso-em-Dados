import { describe, expect, test } from "vitest";

import { canonicalJson, hashPayload } from "./hash";

describe("canonicalJson", () => {
  test("orders object keys at every level", () => {
    expect(canonicalJson({ b: 1, a: { d: [3, { z: 1, y: 2 }], c: null } })).toBe(
      '{"a":{"c":null,"d":[3,{"y":2,"z":1}]},"b":1}',
    );
  });

  test("keeps array order, which is meaningful", () => {
    expect(canonicalJson(["b", "a"])).toBe('["b","a"]');
  });
});

describe("hashPayload", () => {
  test("is a SHA-256 hex digest", () => {
    expect(hashPayload({ a: 1 })).toMatch(/^[0-9a-f]{64}$/);
  });

  test("does not change when only the key order changes", () => {
    expect(hashPayload({ numero: "1", valor: "10,00" })).toBe(
      hashPayload({ valor: "10,00", numero: "1" }),
    );
  });

  test("changes when any value changes", () => {
    expect(hashPayload({ valor: "10,00" })).not.toBe(hashPayload({ valor: "10,01" }));
  });
});
