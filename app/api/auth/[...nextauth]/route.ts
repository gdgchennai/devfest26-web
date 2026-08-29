import { handlers } from "@/auth";

// Auth.js needs Node APIs (crypto) — keep this off the edge runtime.
export const runtime = "nodejs";

export const { GET, POST } = handlers;
