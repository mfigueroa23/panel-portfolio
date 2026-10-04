import { afterEach, describe, expect, it, vi } from "vitest";

async function loadConfig() {
  vi.resetModules();
  return import("./config");
}

describe("config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("falls back to the production API when API_URL is unset", async () => {
    vi.stubEnv("API_URL", undefined);
    const { API_URL } = await loadConfig();
    expect(API_URL).toBe("https://api.figueroa-sanchez.com");
  });

  it("falls back to the production API when API_URL is empty", async () => {
    vi.stubEnv("API_URL", "");
    const { API_URL } = await loadConfig();
    expect(API_URL).toBe("https://api.figueroa-sanchez.com");
  });

  it("uses API_URL when it is set", async () => {
    vi.stubEnv("API_URL", "http://localhost:3000");
    const { API_URL } = await loadConfig();
    expect(API_URL).toBe("http://localhost:3000");
  });

  it("exposes GOOGLE_CLIENT_ID from the environment", async () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "client-id.apps.googleusercontent.com");
    const { GOOGLE_CLIENT_ID } = await loadConfig();
    expect(GOOGLE_CLIENT_ID).toBe("client-id.apps.googleusercontent.com");
  });

  it("defaults GOOGLE_CLIENT_ID to an empty string", async () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", undefined);
    const { GOOGLE_CLIENT_ID } = await loadConfig();
    expect(GOOGLE_CLIENT_ID).toBe("");
  });
});
