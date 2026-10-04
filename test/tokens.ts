// Builds an unsigned JWT-shaped token for tests; only the payload matters,
// because the panel never verifies signatures.
export function makeToken(payload: Record<string, unknown>): string {
  const encode = (value: unknown) =>
    btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode(payload)}.signature`;
}

export function tokenExpiringIn(seconds: number): string {
  return makeToken({ sub: "owner", exp: Math.floor(Date.now() / 1000) + seconds });
}
