/**
 * The event happens in Chennai, so every date and time on the site is stated
 * in Chennai's timezone — never the build server's and never the reader's.
 *
 * Both formatters below pinned this until now, and both were wrong without it.
 * `toLocaleTimeString` with no `timeZone` uses whatever zone the runtime is
 * in, and these pages are statically generated: Vercel builds in UTC, so a
 * 09:00 IST session shipped to every visitor reading "03:30". The agenda
 * components are also client components, so the server (UTC) and the browser
 * (the reader's zone) rendered different text for the same session and
 * disagreed at hydration.
 *
 * A reader in London wanting their own local time is not a case worth serving
 * here — the schedule is for people standing in the venue.
 */
export const EVENT_TIME_ZONE = "Asia/Kolkata";

export function formatSessionTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: EVENT_TIME_ZONE,
  });
}
