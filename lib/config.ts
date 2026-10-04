// Both values are inlined at build time by `next.config.ts` (`env`), so they
// must be read as literal `process.env.X` expressions, never destructured.
const DEFAULT_API_URL = "https://api.figueroa-sanchez.com";

export const API_URL: string = process.env.API_URL || DEFAULT_API_URL;

export const GOOGLE_CLIENT_ID: string = process.env.GOOGLE_CLIENT_ID || "";
