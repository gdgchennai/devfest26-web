import { DurableObject, WorkerEntrypoint } from "cloudflare:workers";
import agenda from "../../content/agenda.json";
import {
  hallZones,
  type HallActor,
  type HallSnapshot,
  type Promotion,
} from "../../lib/hall-model";

type Env = {
  DB: D1Database;
  HALL: DurableObjectNamespace<HallCoordinator>;
  HALL_LOCAL_TEST?: string;
  HALL_LOAD_TEST?: string;
};
const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
const coordinator = (env: Env) =>
  env.HALL.get(env.HALL.idFromName("devfest-chennai-2026"));
class Rejected extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// This named entrypoint has no route. Only a private service binding can invoke it.
export class HallControl extends WorkerEntrypoint<Env> {
  async fetch(request: Request) {
    return coordinator(this.env).fetch(request);
  }
}
export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    if (
      request.method !== "GET" ||
      !["/snapshot", "/socket"].includes(url.pathname)
    )
      return json({ error: "Read only" }, 403);
    return coordinator(env).fetch(request);
  },
} satisfies ExportedHandler<Env>;

export class HallCoordinator extends DurableObject<Env> {
  // blockConcurrencyWhile below serializes snapshot+subscribe, D1 commits and publication.
  // No authoritative state in memory: reconstruction reads D1 and durable rate counters.
  async fetch(request: Request): Promise<Response> {
    return this.ctx.blockConcurrencyWhile(async () => {
      try {
        const path = new URL(request.url).pathname;
        if (request.method === "GET" && path === "/socket")
          return await this.subscribe(request);
        if (request.method === "GET" && path === "/snapshot") {
          await this.limit("public", 6000);
          return json(await this.snapshot());
        }
        if (request.method === "POST" && path === "/access") {
          const actor = (await request.json()) as HallActor;
          const leads = await this.env.DB.prepare(
            "SELECT zone FROM hall_leads WHERE user_id=?",
          )
            .bind(actor.id)
            .all<{ zone: string }>();
          return json({
            actor,
            zones: actor.organizer
              ? hallZones.map((z) => z.id)
              : leads.results.map((z) => z.zone),
          });
        }
        if (request.method !== "POST" || path !== "/write")
          throw new Rejected(404, "Not found");
        if (Number(request.headers.get("content-length") ?? 0) > 16384)
          throw new Rejected(413, "Payload too large");
        const text = await request.text();
        if (text.length > 16384) throw new Rejected(413, "Payload too large");
        const { actor, mutation, failPublication } = JSON.parse(text);
        if (
          !actor ||
          typeof actor.id !== "string" ||
          !actor.id ||
          typeof actor.organizer !== "boolean"
        )
          throw new Rejected(401, "Unauthorized");
        await this.limit(
          `actor:${actor.id}`,
          this.env.HALL_LOCAL_TEST === "1" && this.env.HALL_LOAD_TEST === "1"
            ? 2000
            : 90,
        );
        return await this.write(actor, mutation, failPublication === true);
      } catch (e) {
        if (e instanceof Rejected) {
          const r = json({ error: e.message }, e.status);
          if (e.status === 429) r.headers.set("Retry-After", "60");
          return r;
        }
        if (e instanceof SyntaxError)
          return json({ error: "Invalid JSON" }, 400);
        console.error("Hall coordinator failure", e);
        return json({ error: "Hall service unavailable" }, 503);
      }
    });
  }
  async limit(key: string, maximum: number) {
    const bucket = Math.floor(Date.now() / 60000);
    // Bounded map, persisted in SQLite storage, no dependence on venue IP addresses.
    const counters =
      (await this.ctx.storage.get<
        Record<string, { bucket: number; count: number }>
      >("limits")) ?? {};
    for (const k of Object.keys(counters))
      if (counters[k].bucket !== bucket) delete counters[k];
    const current = counters[key]?.count ?? 0;
    if (current >= maximum || Object.keys(counters).length > 2000)
      throw new Rejected(429, "Too many requests; retry in 60 seconds");
    counters[key] = { bucket, count: current + 1 };
    await this.ctx.storage.put("limits", counters);
  }
  async snapshot(): Promise<HallSnapshot> {
    const meta = await this.env.DB.prepare(
      "SELECT revision,clock FROM hall_meta WHERE id=1",
    ).first<{ revision: number; clock: number | null }>();
    if (!meta) throw new Error("Apply hall migrations first");
    const now = meta.clock ?? Date.now();
    const occupancy = await this.env.DB.prepare(
      "SELECT zone,occupied,revision,updated_at FROM hall_occupancy",
    ).all<HallSnapshot["occupancy"][number]>();
    const promotions = await this.env.DB.prepare(
      "SELECT session,recommended,position FROM hall_promotions",
    ).all<{ session: string; recommended: number; position: number | null }>();
    return {
      revision: meta.revision,
      clock: meta.clock,
      serverNow: now,
      occupancy: occupancy.results,
      promotions: promotions.results
        .filter((p) =>
          agenda.some((s) => s.id === p.session && Date.parse(s.end) > now),
        )
        .map((p) => ({ ...p, recommended: !!p.recommended })),
    };
  }
  async subscribe(request: Request) {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket")
      throw new Rejected(426, "WebSocket required");
    const origin = request.headers.get("Origin");
    if (origin && origin !== new URL(request.url).origin)
      throw new Rejected(403, "Origin rejected");
    await this.limit("connections", 6000);
    if (this.ctx.getWebSockets().length >= 2000)
      throw new Rejected(503, "Connection capacity reached");
    const snapshot = await this.snapshot();
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    pair[1].send(JSON.stringify(snapshot));
    await this.schedule(snapshot);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }
  async write(
    actor: HallActor,
    mutation: Record<string, unknown>,
    failPublication: boolean,
  ) {
    if (
      !mutation ||
      !Number.isSafeInteger(mutation.expected) ||
      Number(mutation.expected) < 0
    )
      throw new Rejected(400, "Expected revision required");
    const state = await this.snapshot();
    const db = this.env.DB;
    const statements: D1PreparedStatement[] = [];
    if (mutation.kind === "occupancy") {
      if (
        typeof mutation.zone !== "string" ||
        !hallZones.some((z) => z.id === mutation.zone)
      )
        throw new Rejected(400, "Unknown zone");
      if (
        !Number.isInteger(mutation.occupied) ||
        Number(mutation.occupied) < 0 ||
        Number(mutation.occupied) > 100
      )
        throw new Rejected(400, "Occupancy must be an integer from 0 to 100");
      if (
        !actor.organizer &&
        !(await db
          .prepare("SELECT 1 FROM hall_leads WHERE user_id=? AND zone=?")
          .bind(actor.id, mutation.zone)
          .first())
      )
        throw new Rejected(403, "Zone not assigned");
      const previous = state.occupancy.find((o) => o.zone === mutation.zone);
      if ((previous?.revision ?? 0) !== mutation.expected)
        throw new Rejected(
          409,
          "Occupancy changed. Review the latest value and retry.",
        );
      statements.push(
        db
          .prepare(
            "INSERT INTO hall_occupancy(zone,occupied,revision,updated_at,updated_by) VALUES(?,?,?,?,?) ON CONFLICT(zone) DO UPDATE SET occupied=excluded.occupied,revision=excluded.revision,updated_at=excluded.updated_at,updated_by=excluded.updated_by",
          )
          .bind(
            mutation.zone,
            mutation.occupied,
            state.revision + 1,
            state.serverNow,
            actor.id,
          ),
      );
    } else if (mutation.kind === "promotions") {
      if (!actor.organizer) throw new Rejected(403, "Organizer required");
      if (mutation.expected !== state.revision)
        throw new Rejected(
          409,
          "List changed. Review the latest order and retry.",
        );
      const list = mutation.promotions;
      if (!Array.isArray(list) || list.length > 100)
        throw new Rejected(400, "Invalid promotion list");
      const ids = new Set(),
        positions = new Set();
      for (const p of list as Promotion[]) {
        if (
          !p ||
          typeof p.session !== "string" ||
          typeof p.recommended !== "boolean" ||
          !(
            p.position === null ||
            (Number.isInteger(p.position) &&
              p.position >= 0 &&
              p.position < 100)
          ) ||
          ids.has(p.session) ||
          (p.position !== null && positions.has(p.position))
        )
          throw new Rejected(400, "Invalid or duplicate promotion");
        const session = agenda.find(
          (s) => s.id === p.session && s.track && s.type !== "break",
        );
        if (!session || Date.parse(session.end) <= state.serverNow)
          throw new Rejected(400, "Unknown or expired session");
        ids.add(p.session);
        if (p.position !== null) positions.add(p.position);
      }
      statements.push(db.prepare("DELETE FROM hall_promotions"));
      for (const p of list as Promotion[])
        statements.push(
          db
            .prepare(
              "INSERT INTO hall_promotions(session,recommended,position) VALUES(?,?,?)",
            )
            .bind(p.session, p.recommended ? 1 : 0, p.position),
        );
    } else if (mutation.kind === "clock") {
      if (this.env.HALL_LOCAL_TEST !== "1" || !actor.organizer)
        throw new Rejected(403, "Local organizer only");
      if (mutation.expected !== state.revision)
        throw new Rejected(409, "Clock changed; retry");
      if (
        mutation.now !== null &&
        (!Number.isSafeInteger(mutation.now) ||
          Number(mutation.now) < 0 ||
          Number(mutation.now) > 4102444800000)
      )
        throw new Rejected(400, "Invalid clock");
      statements.push(
        db
          .prepare("UPDATE hall_meta SET clock=? WHERE id=1")
          .bind(mutation.now),
      );
    } else throw new Rejected(400, "Unknown mutation");
    // Alarm persisted BEFORE D1 commit closes the commit-before-publication crash window.
    await this.ctx.storage.setAlarm(Date.now() + 1000);
    try {
      await db.batch([
        db
          .prepare(
            "INSERT INTO hall_write_guard(value) SELECT CASE WHEN revision=? THEN 1 ELSE 0 END FROM hall_meta WHERE id=1",
          )
          .bind(state.revision),
        ...statements,
        db.prepare("UPDATE hall_meta SET revision=revision+1 WHERE id=1"),
        db
          .prepare(
            "INSERT INTO hall_audit(revision,actor,changed_at,payload) VALUES(?,?,?,?)",
          )
          .bind(
            state.revision + 1,
            actor.id,
            Date.now(),
            JSON.stringify(mutation),
          ),
        db
          .prepare(
            "INSERT INTO hall_outbox(id,revision) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision",
          )
          .bind(state.revision + 1),
        db.prepare("DELETE FROM hall_write_guard"),
      ]);
    } catch (e) {
      if (String(e).includes("CHECK constraint failed"))
        throw new Rejected(409, "Concurrent write; resnapshot and retry");
      throw e;
    }
    const committed = await this.snapshot();
    // Explicit local fault injection; never available in the production environment.
    if (!(failPublication && this.env.HALL_LOCAL_TEST === "1")) {
      try {
        await this.publish(committed);
      } catch (e) {
        console.error("Publication deferred to alarm", e);
      }
    }
    return json(committed);
  }
  async publish(state: HallSnapshot) {
    const message = JSON.stringify(state);
    for (const socket of this.ctx.getWebSockets()) {
      try {
        // Workers exposes no bufferedAmount; send failures close for a resnapshot.
        socket.send(message);
      } catch {
        try {
          socket.close(1011, "Reconnect");
        } catch {}
      }
    }
    await this.env.DB.prepare("DELETE FROM hall_outbox WHERE revision<=?")
      .bind(state.revision)
      .run();
    await this.schedule(state);
  }
  async schedule(state: HallSnapshot) {
    const pending = await this.env.DB.prepare(
      "SELECT revision FROM hall_outbox WHERE id=1",
    ).first();
    if (pending) {
      await this.ctx.storage.setAlarm(Date.now() + 1000);
      return;
    }
    const boundaries = agenda
      .flatMap((s) => [Date.parse(s.start), Date.parse(s.end)])
      .filter((t) => t > state.serverNow);
    if (
      state.clock === null &&
      boundaries.length &&
      this.ctx.getWebSockets().length
    )
      await this.ctx.storage.setAlarm(Math.min(...boundaries));
    else await this.ctx.storage.deleteAlarm();
  }
  async alarm() {
    await this.ctx.blockConcurrencyWhile(async () => {
      // Persist next retry before attempting D1, so errors cannot strand the outbox.
      await this.ctx.storage.setAlarm(Date.now() + 5000);
      await this.publish(await this.snapshot());
    });
  }
  webSocketMessage(socket: WebSocket, message: string | ArrayBuffer) {
    socket.close(
      typeof message === "string" && message.length <= 256 ? 1008 : 1009,
      "Read only",
    );
  }
  webSocketClose(socket: WebSocket, code: number) {
    socket.close(code === 1006 ? 1000 : code, "Closed");
  }
  webSocketError(socket: WebSocket) {
    socket.close(1011, "Reconnect");
  }
}
