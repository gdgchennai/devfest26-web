/// <reference types="@cloudflare/workers-types" />

// Bindings and secrets this Worker reads at runtime, on top of the ones
// @opennextjs/cloudflare already declares on `CloudflareEnv`. Regenerate the
// full picture any time with `npm run cf-typegen`.
declare global {
  interface CloudflareEnv {
    /** D1 database — accounts + saved sessions. See wrangler.jsonc + migrations/. */
    DB: D1Database;
    /** Auth.js signing secret (`openssl rand -base64 32`). */
    AUTH_SECRET: string;
    /** Google OAuth 2.0 client credentials. */
    AUTH_GOOGLE_ID: string;
    AUTH_GOOGLE_SECRET: string;
  }
}

export {};
