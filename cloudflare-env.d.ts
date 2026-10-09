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
    /** Gemini API key for the typing game's word-generation prompt. */
    GEMINI_API_KEY?: string;
    /** Gemini model id for that prompt. Optional — see DEFAULT_GEMINI_MODEL in
     *  app/api/games/typing/route.ts. Set this when a model is retired. */
    GEMINI_MODEL?: string;
    /** VAPID private key for Web Push (base64url `d` scalar). Pairs with the
     *  public NEXT_PUBLIC_VAPID_PUBLIC_KEY build-time var. See lib/push.ts. */
    VAPID_PRIVATE_KEY: string;
    /** Comma-separated organizer emails allowed into /admin. See lib/admin.ts. */
    ADMIN_EMAILS?: string;
  }
}

export {};
