// Read-only session validation. Secrets are returned only to the local runner,
// never printed, persisted in reports, or accepted in command-line arguments.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
export const HOSTED_HALL =
  "https://devfest-hall-availability-test.gdg-chennai.workers.dev";
function privateFile(file) {
  const stat = fs.statSync(file);
  assert.ok(
    stat.isFile() && (stat.mode & 0o077) === 0,
    "Credential/manifest files must be private regular files (0600)",
  );
  return fs.readFileSync(file, "utf8");
}
export async function organizerSessions(manifestPath, base = HOSTED_HALL) {
  assert.ok(
    [HOSTED_HALL, "http://127.0.0.1:8787"].includes(base),
    "Target not allowlisted",
  );
  const manifest = JSON.parse(privateFile(manifestPath));
  assert.ok(
    Array.isArray(manifest.sessions) &&
      manifest.sessions.length >= 1 &&
      manifest.sessions.length <= 20,
    "Supply one to twenty session files",
  );
  const skipped = [],
    entries = [];
  for (let i = 0; i < manifest.sessions.length; i++) {
    try {
      const entry = manifest.sessions[i];
      const raw = privateFile(
        path.resolve(path.dirname(manifestPath), entry.cookieFile),
      ).trim();
      assert.ok(!/[\r\n]/.test(raw), "Supply one Cookie header line");
      const cookies = raw
        .replace(/^cookie:\s*/i, "")
        .split(";")
        .map((s) => s.trim())
        .filter((s) =>
          /^(?:__Secure-)?authjs\.session-token(?:\.\d+)?=.+/.test(s),
        );
      assert.ok(cookies.length, "Missing Auth.js session cookie/chunks");
      entries.push({
        cookie: cookies.join("; "),
        requestedZone: entry.zone,
        session: i + 1,
      });
    } catch {
      skipped.push({
        session: i + 1,
        reason: "Missing, insecure or malformed cookie file",
      });
    }
  }
  const response = await fetch(base + "/api/halls", {
    signal: AbortSignal.timeout(15000),
  });
  assert.equal(response.status, 200, "Public snapshot preflight failed");
  const snapshot = await response.json();
  const known = new Set(snapshot.occupancy.map((o) => o.zone));
  const ids = new Set(),
    actors = [];
  for (const entry of entries) {
    try {
      const result = await fetch(base + "/api/admin/halls", {
        headers: { Cookie: entry.cookie },
        signal: AbortSignal.timeout(15000),
      });
      assert.equal(
        result.status,
        200,
        `Organizer access returned HTTP ${result.status}`,
      );
      const access = await result.json();
      assert.ok(
        access.actor?.id && Array.isArray(access.zones),
        "Invalid access response",
      );
      assert.ok(
        !ids.has(access.actor.id),
        "Duplicate actor: separate tabs share one rate limit",
      );
      const zones = access.zones.filter((z) => known.has(z));
      const zone = entry.requestedZone ?? zones[actors.length % zones.length];
      assert.ok(
        zone && zones.includes(zone),
        "No permission on the selected existing measured zone",
      );
      ids.add(access.actor.id);
      actors.push({
        session: entry.session,
        id: access.actor.id,
        actorReference: createHash("sha256")
          .update(access.actor.id)
          .digest("hex")
          .slice(0, 12),
        cookie: entry.cookie,
        zone,
        zones,
      });
    } catch (error) {
      skipped.push({ session: entry.session, reason: error.message });
    }
  }
  assert.ok(actors.length, "No usable organizer sessions");
  return { actors, skipped, snapshot };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  try {
    assert.ok(process.argv[2], "Pass a private organizers.json path");
    const { actors, skipped, snapshot } = await organizerSessions(
      process.argv[2],
    );
    console.log(
      JSON.stringify(
        {
          result: "PASS",
          readonly: true,
          authorizedDistinctActors: actors.length,
          skipped,
          twoMinuteRateFitsProductionLimit: actors.length >= 3,
          snapshotRevision: snapshot.revision,
          actors: actors.map(({ session, actorReference, zone }) => ({
            session,
            actorReference,
            zone,
          })),
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(`Organizer preflight stopped: ${error.message}`);
    process.exitCode = 1;
  }
}
