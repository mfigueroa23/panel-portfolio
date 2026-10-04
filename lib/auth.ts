import { apiFetch, type ApiResult } from "./api";

export interface AccessToken {
  accessToken: string;
  expiresIn: number;
}

/** Exchanges Google's ID token (`credential`) for the API's session token. */
export function signInWithGoogle(credential: string): Promise<ApiResult<AccessToken>> {
  return apiFetch<AccessToken>("/auth/google", {
    method: "POST",
    body: { credential },
  });
}
