/**
 * The ticket names KonfHub is configured with for DevFest Chennai 2026.
 * Used only for sanity-logging — if a webhook carries a name that's in
 * neither set, someone renamed a ticket type on KonfHub and this list needs
 * updating. Nothing branches on it.
 */

export const MAIN_TICKET_NAMES = new Set<string>([
  "Early Professional",
  "Professional",
  "Late Professional",
  "Professionals - For women & diverse groups",
  "Professional - IDC Exclusive",
  "Early Student",
  "Student",
  "Late Students",
  "Student - For Women & diverse groups",
  "Student - IDC Exclusive",
  "Volunteers",
  "GDGCore",
  "Speakers",
  "Speakers Companions",
  "GDG Core Companions",
]);

export const ADDON_TICKET_NAMES = new Set<string>([
  "GDG Chennai Tshirt",
  "Complimentary Tshirt",
  "Bike parking",
  "Car parking",
  "I'm bringing my child (10 - 16 years)",
]);

export function isKnownTicketName(name: string): boolean {
  return MAIN_TICKET_NAMES.has(name) || ADDON_TICKET_NAMES.has(name);
}
