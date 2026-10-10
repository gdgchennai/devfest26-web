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
  return new Date(iso)
    .toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: EVENT_TIME_ZONE,
    })
    .toUpperCase();
}

/** The IST hour a session starts in, as "09" — used to group sessions under
 *  hour dividers on the spatial agenda board's timeline. Stays 24-hour and
 *  zero-padded so it sorts and compares as a stable key; use
 *  `formatHourLabel` to display it. */
export function sessionHour(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    hour12: false,
    timeZone: EVENT_TIME_ZONE,
  });
}

/** Formats a `sessionHour` value ("00"–"23") as a 12-hour label, e.g. "8 AM". */
export function formatHourLabel(hour24: string): string {
  const h = Number(hour24) % 24;
  const period = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12} ${period}`;
}
