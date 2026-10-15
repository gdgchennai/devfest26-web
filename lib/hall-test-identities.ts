// Selector labels match production RBAC; values retain existing fixture identities.
export const hallTestIdentities = [
  { value: "organizer", label: "Super admin", zones: null, adminZones: [] },
  {
    value: "admin-tech",
    label: "Admin (organizer) · Tech",
    zones: ["d7-auditorium"],
    adminZones: ["d7-auditorium"],
  },
  {
    value: "admin-deep",
    label: "Admin (organizer) · Deep tech",
    zones: ["d7-amphitheater"],
    adminZones: ["d7-amphitheater"],
  },
  {
    value: "lead-tech",
    label: "Track lead · Tech",
    zones: ["d7-auditorium"],
    adminZones: [],
  },
  {
    value: "lead-deep",
    label: "Track lead · Deep tech",
    zones: ["d7-amphitheater"],
    adminZones: [],
  },
  {
    value: "user",
    label: "User · no control access",
    zones: [],
    adminZones: [],
  },
  { value: "public", label: "Signed out", zones: [], adminZones: [] },
];
