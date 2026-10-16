/** Missing means enabled, so existing/local deployments retain their behavior. */
export function hallLiveEnabled(env: { HALL_LIVE_ENABLED?: string }) {
  return env.HALL_LIVE_ENABLED?.trim().toLowerCase() !== "false";
}

export const HALL_AVAILABILITY_PATH = "/api/halls/availability";
export const HALL_FALLBACK_PATH = "/agenda";
export const HALL_CONNECTION_GRACE_MS = 20_000;
