import { describe, expect, it } from "vitest";
import { isLive, tokenExpiry } from "./token";

function base64url(value: string): string {
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function makeToken(payload: unknown): string {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  return `${header}.${base64url(JSON.stringify(payload))}.signature`;
}

const EXP = 1_800_000_000; // seconds

describe("tokenExpiry", () => {
  it("returns the payload's exp without verifying the signature", () => {
    expect(tokenExpiry(makeToken({ sub: "owner", exp: EXP }))).toBe(EXP);
  });

  it("decodes base64url payloads that need padding", () => {
    // Payload lengths that are not multiples of 3 produce unpadded base64url.
    expect(tokenExpiry(makeToken({ exp: EXP, sub: "ow" }))).toBe(EXP);
    expect(tokenExpiry(makeToken({ exp: EXP, sub: "own" }))).toBe(EXP);
  });

  it.each([
    ["an empty string", ""],
    ["a token without three parts", "abc.def"],
    ["a payload that is not base64", "a.@@@.c"],
    ["a payload that is not JSON", `a.${base64url("not json")}.c`],
    ["a payload without exp", makeToken({ sub: "owner" })],
    ["a non-numeric exp", makeToken({ exp: "soon" })],
    ["a JSON payload that is not an object", makeToken(42)],
  ])("returns null for %s", (_name, token) => {
    expect(tokenExpiry(token)).toBeNull();
  });
});

describe("isLive", () => {
  const token = makeToken({ exp: EXP });
  const expMs = EXP * 1000;

  it("is live while exp is more than 5 s ahead", () => {
    expect(isLive(token, expMs - 60_000)).toBe(true);
    expect(isLive(token, expMs - 5_001)).toBe(true);
  });

  it("is not live when exp is exactly 5 s ahead", () => {
    expect(isLive(token, expMs - 5_000)).toBe(false);
  });

  it("is not live inside the margin or after exp", () => {
    expect(isLive(token, expMs - 4_999)).toBe(false);
    expect(isLive(token, expMs)).toBe(false);
    expect(isLive(token, expMs + 1)).toBe(false);
  });

  it("is not live for a malformed token", () => {
    expect(isLive("not-a-token", 0)).toBe(false);
  });

  it("defaults now to the current time", () => {
    const future = makeToken({ exp: Math.floor(Date.now() / 1000) + 3600 });
    const past = makeToken({ exp: Math.floor(Date.now() / 1000) - 1 });
    expect(isLive(future)).toBe(true);
    expect(isLive(past)).toBe(false);
  });
});
