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
  env.HALL.get(env.HALL.idFromName("devfest-chennai-2026-day"));
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
  private current: HallSnapshot | null = null;
  private ready: Promise<void> | null = null;
  private writes: Promise<unknown> = Promise.resolve();
  private limitBucket = -1;

  // D1 is persistent truth. Rebuild once per instance, including after hibernation.
  // Lazy initialization also lets isolated fixtures apply migrations before first use.
  private initialize() {
    return (this.ready ??= this.ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS hall_rate_limits (
        key TEXT PRIMARY KEY, bucket INTEGER NOT NULL, count INTEGER NOT NULL)`);
      // Carry over counters from the earlier KV implementation on first deployment.
      const legacy =
        await this.ctx.storage.get<
          Record<string, { bucket: number; count: number }>
        >("limits");
      for (const [key, value] of Object.entries(legacy ?? {}))
        this.ctx.storage.sql.exec(
          "INSERT OR IGNORE INTO hall_rate_limits VALUES(?,?,?)",
          key,
          value.bucket,
          value.count,
        );
      if (legacy) await this.ctx.storage.delete("limits");
      this.current = await this.readSnapshot();
      // Recover a commit made before the previous instance could publish it.
      const pending = await this.env.DB.prepare(
        "SELECT revision FROM hall_outbox WHERE id=1",
      ).first();
      if (pending) await this.publish(this.current);
    }));
  }

  // Only writers and alarm recovery queue behind remote D1 I/O. Readers remain
  // available with the last committed revision; a subsequent publish reaches them.
  private exclusive<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.writes.then(operation);
    this.writes = result.catch(() => {});
    return result;
  }

  private snapshot(): HallSnapshot {
    if (!this.current) throw new Error("Hall state not initialized");
    return { ...this.current, serverNow: this.current.clock ?? Date.now() };
  }
  // Direct D1 edits (ops reset) leave an outbox revision the awake cache has
  // not installed. Adopt it before serving readers so they do not stay on the
  // previous in-memory snapshot.
  private async adoptOutbox() {
    const pending = await this.env.DB.prepare(
      "SELECT revision FROM hall_outbox WHERE id=1",
    ).first<{ revision: number }>();
    if (!pending || pending.revision <= (this.current?.revision ?? 0)) return;
    await this.publish(await this.readSnapshot());
  }
  async fetch(request: Request): Promise<Response> {
    try {
      await this.initialize();
      const path = new URL(request.url).pathname;
      if (request.method === "GET" && path === "/socket") {
        await this.exclusive(() => this.adoptOutbox());
        return await this.subscribe(request);
      }
      if (request.method === "GET" && path === "/snapshot") {
        this.limit("public", 6000);
        await this.exclusive(() => this.adoptOutbox());
        return json(this.snapshot());
      }
      if (request.method === "POST" && path === "/access") {
        const actor = (await request.json()) as HallActor;
        return json({ actor, zones: await this.zones(actor) });
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
      this.limit(
        `actor:${actor.id}`,
        this.env.HALL_LOCAL_TEST === "1" && this.env.HALL_LOAD_TEST === "1"
          ? 2000
          : 90,
      );
      return await this.exclusive(() =>
        this.write(actor, mutation, failPublication === true),
      );
    } catch (e) {
      if (e instanceof Rejected) {
        const r = json({ error: e.message }, e.status);
        if (e.status === 429) r.headers.set("Retry-After", "60");
        return r;
      }
      if (e instanceof SyntaxError) return json({ error: "Invalid JSON" }, 400);
      console.error("Hall coordinator failure", e);
      return json({ error: "Hall service unavailable" }, 503);
    }
  }
  async zones(actor: HallActor): Promise<string[]> {
    if (actor.organizer) return hallZones.map((z) => z.id);
    if (actor.zones !== undefined)
      return actor.zones.filter((id) => hallZones.some((z) => z.id === id));
    // Legacy assignments exist only for isolated local fixtures. Production
    // permissions always come from the current RBAC adapter on each request.
    if (
      this.env.HALL_LOCAL_TEST !== "1" ||
      !["dev:lead-tech", "dev:lead-deep"].includes(actor.id)
    )
      return [];
    const leads = await this.env.DB.prepare(
      "SELECT zone FROM hall_leads WHERE user_id=?",
    )
      .bind(actor.id)
      .all<{ zone: string }>();
    return leads.results.map((z) => z.zone);
  }
  limit(key: string, maximum: number) {
    // Synchronous SQLite read/check/write cannot interleave. Output gates persist
    // counters before sending responses, without an async KV round trip per viewer.
    const bucket = Math.floor(Date.now() / 60000);
    const sql = this.ctx.storage.sql;
    if (this.limitBucket !== bucket) {
      sql.exec("DELETE FROM hall_rate_limits WHERE bucket<>?", bucket);
      this.limitBucket = bucket;
    }
    const existing = sql
      .exec<{ count: number }>(
        "SELECT count FROM hall_rate_limits WHERE key=?",
        key,
      )
      .toArray()[0];
    if (existing && existing.count >= maximum)
      throw new Rejected(429, "Too many requests; retry in 60 seconds");
    if (
      !existing &&
      sql.exec<{ n: number }>("SELECT count(*) n FROM hall_rate_limits").one()
        .n >= 2000
    )
      throw new Rejected(429, "Too many requests; retry in 60 seconds");
    sql.exec(
      "INSERT INTO hall_rate_limits VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET count=count+1",
      key,
      bucket,
    );
  }
  async readSnapshot(): Promise<HallSnapshot> {
    // One D1 batch reduces cross-region round trips and reads one consistent state.
    const rows = await this.env.DB.batch([
      this.env.DB.prepare("SELECT revision,clock FROM hall_meta WHERE id=1"),
      this.env.DB.prepare(
        "SELECT zone,occupied,revision,updated_at FROM hall_occupancy",
      ),
      this.env.DB.prepare(
        "SELECT session,recommended,position FROM hall_promotions",
      ),
      this.env.DB.prepare(
        "SELECT session,status,updated_at FROM hall_sessions",
      ),
    ]);
    const meta = rows[0].results[0] as
      { revision: number; clock: number | null } | undefined;
    if (!meta) throw new Error("Apply hall migrations first");
    const now = meta.clock ?? Date.now();
    const occupancy = rows[1] as D1Result<HallSnapshot["occupancy"][number]>;
    const promotions = rows[2] as D1Result<{
      session: string;
      recommended: number;
      position: number | null;
    }>;
    const sessions = rows[3] as D1Result<HallSnapshot["sessions"][number]>;
    return {
      sessions: sessions.results,
      revision: meta.revision,
      clock: meta.clock,
      serverNow: now,
      occupancy: occupancy.results,
      promotions: promotions.results
        .filter(
          (p) =>
            agenda.some((s) => s.id === p.session) &&
            !sessions.results.some(
              (s) => s.session === p.session && s.status === "ended",
            ),
        )
        .map((p) => ({ ...p, recommended: !!p.recommended })),
    };
  }
  subscribe(request: Request) {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket")
      throw new Rejected(426, "WebSocket required");
    const origin = request.headers.get("Origin");
    if (origin && origin !== new URL(request.url).origin)
      throw new Rejected(403, "Origin rejected");
    this.limit("connections", 6000);
    if (this.ctx.getWebSockets().length >= 2000)
      throw new Rejected(503, "Connection capacity reached");
    // No await from reading current through accepting/sending. Publication likewise
    // installs and broadcasts synchronously: subscribe before it gets the broadcast,
    // subscribe after it gets the new initial snapshot. No missed-update window.
    const snapshot = this.snapshot();
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    pair[1].send(JSON.stringify(snapshot));
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
    // Fresh D1 read also reconciles an ambiguous failure in an earlier commit.
    const state = await this.readSnapshot();
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
      if (!(await this.zones(actor)).includes(mutation.zone))
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
      if (!actor.organizer) throw new Rejected(403, "Super admin required");
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
        if (
          !session ||
          state.sessions.some(
            (s) => s.session === p.session && s.status === "ended",
          )
        )
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
    } else if (mutation.kind === "session") {
      const session = agenda.find(
        (s) =>
          s.id === mutation.session &&
          s.track === mutation.zone &&
          s.type !== "break",
      );
      if (!session || !["started", "ended"].includes(String(mutation.status)))
        throw new Rejected(400, "Invalid event transition");
      if (!(await this.zones(actor)).includes(session.track!))
        throw new Rejected(403, "Track not assigned");
      if (mutation.expected !== state.revision)
        throw new Rejected(409, "Events changed. Review and retry.");
      const existing = state.sessions.find((s) => s.session === session.id);
      if (mutation.status === "ended" && existing?.status !== "started")
        throw new Rejected(409, "Only a running event can end");
      if (
        mutation.status === "started" &&
        state.sessions.some(
          (s) =>
            s.status === "started" &&
            agenda.find((a) => a.id === s.session)?.track === session.track,
        )
      )
        throw new Rejected(
          409,
          "End the running event before starting another",
        );
      statements.push(
        db
          .prepare(
            "INSERT INTO hall_sessions(session,status,updated_at,updated_by) VALUES(?,?,?,?) ON CONFLICT(session) DO UPDATE SET status=excluded.status,updated_at=excluded.updated_at,updated_by=excluded.updated_by",
          )
          .bind(session.id, mutation.status, Date.now(), actor.id),
      );
      if (mutation.status === "ended")
        statements.push(
          db
            .prepare("DELETE FROM hall_promotions WHERE session=?")
            .bind(session.id),
        );
    } else if (mutation.kind === "reset") {
      if (!actor.organizer) throw new Rejected(403, "Super admin required");
      if (mutation.expected !== state.revision)
        throw new Rejected(409, "Events changed. Review and retry.");
      statements.push(
        db.prepare("DELETE FROM hall_sessions"),
        db.prepare("DELETE FROM hall_promotions"),
        db.prepare("DELETE FROM hall_occupancy"),
        db.prepare("UPDATE hall_meta SET clock=NULL WHERE id=1"),
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
    const committed = await this.readSnapshot();
    this.current = committed;
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
    this.current = state;
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
    await this.schedule();
  }
  async schedule() {
    const pending = await this.env.DB.prepare(
      "SELECT revision FROM hall_outbox WHERE id=1",
    ).first();
    if (pending) {
      await this.ctx.storage.setAlarm(Date.now() + 1000);
      return;
    }
    await this.ctx.storage.deleteAlarm();
  }
  async alarm() {
    await this.initialize();
    await this.exclusive(async () => {
      // Persist next retry before attempting D1, so errors cannot strand the outbox.
      await this.ctx.storage.setAlarm(Date.now() + 5000);
      await this.publish(await this.readSnapshot());
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
