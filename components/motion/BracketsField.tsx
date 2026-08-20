"use client";

import { useEffect, useRef } from "react";
// Type-only: erased at build. The runtime namespace and the SVGLoader addon are
// fetched inside the effect via `await import(...)`, so three.js lands in its
// own chunk instead of the homepage's initial JS. Both this component and
// CurvedMarqueeHero must do it — one static import anywhere pulls the whole
// library back into the initial bundle.
import type * as THREE from "three";
import { clamp } from "@/lib/easing";
import { shouldUseStaticBaseline } from "@/lib/motion-prefs";
import { markReady, markFailed, BRACKETS_READY } from "@/lib/assetReady";

/** The dynamically-imported three.js namespace, passed to the builders below. */
type Three = typeof import("three");
/** The SVGLoader class itself (its statics are used, not just instances). */
type SvgLoaderCtor = typeof import("three/addons/loaders/SVGLoader.js").SVGLoader;

/* ------------------------------------------------------------------ *
 * The 3D brand-shape backdrop: a FIXED, full-viewport black layer behind
 * the whole page (content scrolls over it). It holds two brackets — a
 * sticky pair, built from the brand SVGs (public/brand-shapes) as extruded
 * 3D meshes, that hold their place near the edges and drift/turn gently as
 * you scroll (they never travel up the page).
 *
 * Everything is a pure function of scroll position — nothing runs on a
 * clock — and every animated quantity advances at the same even rate, so
 * the whole backdrop moves as one. Renders only when the scroll changes.
 * ------------------------------------------------------------------ */

const SHAPE_BASE = "/brand-shapes/";
/** viewBox heights, used to give each shape a proportional extrude depth. */
const VIEWBOX_H: Record<string, number> = {
  "left_bracket.svg": 304,
  "right_bracket.svg": 304,
};

/**
 * Brand palette every shape cycles through, wrapped so the loop is seamless.
 * Held as raw hex because THREE.Color instances can only be built once the
 * library has been dynamically imported — module scope runs before that.
 */
const PALETTE_HEX = [0x4285f4, 0xea4335, 0xf9ab00, 0x34a853];
const PALETTE_STOPS_HEX = [...PALETTE_HEX, PALETTE_HEX[0]];

/** Target on-screen height of a bracket, in world units — kept small. */
const BRACKET_HEIGHT = 1.4;

/*
 * Footer settle target. As the page bottom is reached the two brackets ease
 * onto the slots the wordmark's brackets occupy in brand-assets/devfest-logo.svg,
 * framing the footer logo (which renders the bracket-less wo variant, viewBox
 * 1370×531, via id="footer-logo"). All values are in that wo-viewBox space:
 * the wo lockup is the full logo shifted left by 257.6, so a full-logo x maps
 * to wo-x = x − 257.6.
 */
const WO_VBW = 1370; // wo-brackets logo viewBox width
const SETTLE_LEFT_CX = -169.25; // left bracket centre  (full 88.35 − 257.6)
const SETTLE_RIGHT_CX = 1537.8; // right bracket centre (full 1795.4 − 257.6)
const SETTLE_CY = 265.15; // bracket vertical centre
const SETTLE_BRACKET_H = 530.3; // bracket height (spans the whole lockup)
/** Brackets are the brand gold once settled, like the logo. */
const SETTLE_COLOR_HEX = 0xf9ab00;

type BracketConfig = {
  file: string;
  /** Which edge it's parked at before it enters: -1 left, +1 right. */
  side: -1 | 1;
  /** Seed that decorrelates this bracket's random-feeling path from the other. */
  seed: number;
  /** Offset into the palette so the two show different colours at once. */
  colorOffset: number;
  /** Starting angle on the shared orbit; the pair sit a half-turn apart. */
  baseAngle: number;
  /** Direction of the bracket's own-axis spin (1 / -1) — the two spin opposite. */
  spinDir: 1 | -1;
};

const BRACKETS: BracketConfig[] = [
  { file: "left_bracket.svg", side: -1, seed: 0, colorOffset: 0, baseAngle: Math.PI, spinDir: 1 },
  { file: "right_bracket.svg", side: 1, seed: 4.7, colorOffset: 0.5, baseAngle: 0, spinDir: -1 },
];

/** Revolutions the pair make around the centre across the whole page. */
const BRACKET_REVOLVE = Math.PI * 2 * 1.25;
/** Own-axis spins each bracket makes across the whole page. */
const BRACKET_SPIN = Math.PI * 2 * 1.5;

/**
 * Smooth pseudo-random value in ~[-1, 1], summed from two low, close, non-
 * harmonic frequencies: enough variety to feel unplanned, but the rate of
 * change stays gentle and even so every channel moves at a similar pace. Pure
 * function of scroll `t` + `seed`, so it's deterministic and scroll-only.
 */
function fbm(t: number, seed: number): number {
  return Math.sin(t * 4.2 + seed * 12.9898) * 0.7 + Math.sin(t * 7.3 + seed * 78.233) * 0.3;
}

/** Smoothly samples the wrapped palette at t (0..1). `stops` is built in the effect. */
function colorAt(t: number, out: THREE.Color, stops: THREE.Color[]) {
  const wrapped = ((t % 1) + 1) % 1;
  const seg = wrapped * (stops.length - 1);
  const i = Math.floor(seg);
  return out.copy(stops[i]).lerp(stops[i + 1], seg - i);
}

type SvgPaths = ReturnType<InstanceType<SvgLoaderCtor>["parse"]>["paths"];

/** Extrudes loaded SVG paths into a centred, upright geometry scaled to targetH. */
function buildGeometry(
  T: Three,
  paths: SvgPaths,
  targetH: number,
  viewBoxH: number,
): THREE.ExtrudeGeometry {
  // toShapes() takes no arguments in three 0.185 — the old `isCCW` flag was
  // removed upstream, and hole winding is now resolved from the path data
  // itself. Passing it was a silent no-op at runtime but a build-breaking
  // type error. Same change in buildLogo below.
  const shapes = paths.flatMap((p) => p.toShapes());
  const depth = viewBoxH * 0.14;
  const geometry = new T.ExtrudeGeometry(shapes, {
    depth,
    bevelEnabled: true,
    bevelThickness: viewBoxH * 0.012,
    bevelSize: viewBoxH * 0.009,
    bevelSegments: 3,
    curveSegments: 20,
  });
  // Scale to the target world height off the actual geometry bounds, flip Y
  // (SVG's Y points down), and recentre so it spins about its own middle.
  geometry.computeBoundingBox();
  const bb = geometry.boundingBox;
  const h = bb ? bb.max.y - bb.min.y : 1;
  const s = targetH / (h || 1);
  geometry.scale(s, -s, s);
  geometry.center();
  geometry.computeVertexNormals();
  return geometry;
}

// The 3D lockup settles on the HOMEPAGE footer, which now stays on the
// page's permanent black (see MoodSection's doc comment — the
// black → white → pastel-yellow handoffs this settle was originally tuned
// for are gone; --page-bg lands on black at Location and never moves
// again), so its wordmark must be light on black. This -dark variant draws
// it in #F0F0F0 (near-white); the white pill and its black "Chennai"
// letters are untouched — same geometry either way, only the wordmark fill
// differs between this and -light (#131313, for a light footer). buildLogo
// groups paths by fill and gives each role its own extrusion (see there).
// FooterLogo's own flat <img> fallback (other routes, reduced-motion/lite)
// already uses this same -dark file for the same reason.
const LOGO_FILE = "/brand-assets/devfest-logo-wo-brackets-dark.svg";
/** wo-brackets viewBox height, for proportional extrude depths. */
const LOGO_VBH = 531;

type LogoBuild = { group: THREE.Group; geos: THREE.BufferGeometry[]; mats: THREE.MeshStandardMaterial[] };

/**
 * Extrudes the whole wo-brackets lockup (DevFest wordmark, Chennai pill and its
 * text) into one 3D group, so it reads as extruded like the brackets. Paths are
 * grouped by SVG fill → one material each. The white pill is the back-plate and
 * gets less depth; the ink/black text is deeper so it stands proud of the pill
 * front face instead of z-fighting it. Built centred, upright (Y flipped) and
 * scaled to targetH; every material starts transparent (faded in on settle).
 */
function buildLogo(T: Three, paths: SvgPaths, targetH: number): LogoBuild {
  const byFill = new Map<string, SvgPaths>();
  for (const p of paths) {
    const fill = ((p.userData as { style?: { fill?: string } } | undefined)?.style?.fill ?? "#000").toLowerCase();
    if (fill === "none") continue;
    const list = byFill.get(fill) ?? [];
    list.push(p);
    byFill.set(fill, list);
  }

  // Depth of the raised Chennai box (white pill), in wo-viewBox units. Its
  // letters are lifted by the same amount so they sit on the box's front face.
  const PILL_DEPTH = LOGO_VBH * 0.16;

  const built: { geo: THREE.ExtrudeGeometry; fill: string }[] = [];
  for (const [fill, ps] of byFill) {
    const shapes = ps.flatMap((p) => p.toShapes());
    if (shapes.length === 0) continue;
    const isPlate = fill === "white" || fill === "#ffffff" || fill === "#fff";
    const isPillText = fill === "black" || fill === "#000" || fill === "#000000";
    // The Chennai box is the deepest element (a distinctly raised 3D block); its
    // "Chennai" letters are thin and ride on its front face; the DevFest
    // wordmark keeps the base depth.
    const depth = isPlate ? PILL_DEPTH : LOGO_VBH * (isPillText ? 0.05 : 0.09);
    const geo = new T.ExtrudeGeometry(shapes, {
      depth,
      bevelEnabled: true,
      bevelThickness: LOGO_VBH * (isPlate ? 0.012 : 0.004),
      bevelSize: LOGO_VBH * (isPlate ? 0.01 : 0.003),
      bevelSegments: isPlate ? 4 : 3,
      curveSegments: 16,
    });
    // Lift the letters onto the raised box so they stay proud instead of sinking
    // into it (extrusion runs 0 → depth toward the camera, so back = box front).
    if (isPillText) geo.translate(0, 0, PILL_DEPTH);
    geo.computeBoundingBox();
    built.push({ geo, fill });
  }

  // Union bounds across every fill, so the whole lockup scales/centres as one.
  const box = new T.Box3();
  for (const { geo } of built) if (geo.boundingBox) box.union(geo.boundingBox);
  const h = box.max.y - box.min.y || 1;
  const s = targetH / h;
  const cx = (box.min.x + box.max.x) / 2;
  const cy = (box.min.y + box.max.y) / 2;

  const group = new T.Group();
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.MeshStandardMaterial[] = [];
  for (const { geo, fill } of built) {
    geo.translate(-cx, -cy, 0); // back stays at z≈0; deeper fills sit forward
    geo.scale(s, -s, s); // flip Y (SVG points down)
    geo.computeVertexNormals();
    // The white pill is self-lit so the scene lights don't shade it grey — it
    // should read as bright white like the flat mark.
    const isPlate = fill === "white" || fill === "#ffffff" || fill === "#fff";
    const mat = new T.MeshStandardMaterial({
      color: new T.Color(fill),
      // The pill now reads its 3D form from scene shading rather than being
      // self-lit flat: on the light footer a bright, un-shaded white box would
      // vanish into the page, so drop the emissive lift and let its deep sides
      // and bevel catch the light. A little metalness sharpens the edges.
      roughness: isPlate ? 0.42 : 0.45,
      metalness: isPlate ? 0.12 : 0.12,
      emissive: new T.Color(0x000000),
      emissiveIntensity: 0,
      side: T.DoubleSide,
      transparent: true,
      opacity: 0,
    });
    group.add(new T.Mesh(geo, mat));
    geos.push(geo);
    mats.push(mat);
  }
  group.visible = false;
  return { group, geos, mats };
}

/**
 * Builds the whole WebGL backdrop into `host` and returns its teardown.
 *
 * Split out of the component so the effect can `await import("three")` and
 * hand the namespace in: keeping this inline would force a static import and
 * pull the entire library into the homepage's initial JS.
 *
 * `mode`: "scroll" (default) is the homepage's usual behaviour — brackets
 * drift/orbit and only ease onto the footer logo over the last ~0.85
 * viewport of scroll. "settled" pins them onto the footer logo permanently
 * (settle forced to 1 on every frame, never ramped from scroll position) —
 * for pages that want the framed-logo look without the homepage's drift
 * choreography preceding it. Positions are still recomputed on scroll/resize
 * (the footer logo's on-screen rect moves as the page scrolls), just never
 * un-settled.
 */
function mount(host: HTMLDivElement, T: Three, Loader: SvgLoaderCtor, mode: "scroll" | "settled" = "scroll"): () => void {
  let disposed = false;

  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(50, host.clientWidth / host.clientHeight, 0.1, 100);
  camera.position.z = 6;

  const renderer = new T.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(host.clientWidth, host.clientHeight);
  // Supersample to at least 2× even on 1× (non-retina) displays: WebGL's MSAA
  // alone leaves the high-contrast shape edges looking jagged against the
  // crisp DOM text, and this renders on scroll only, so the cost is fine.
  renderer.setPixelRatio(Math.min(Math.max(window.devicePixelRatio, 2), 2));
  host.appendChild(renderer.domElement);

  scene.add(new T.AmbientLight(0xffffff, 0.9));
  const key = new T.DirectionalLight(0xffffff, 2.2);
  key.position.set(-4, 5, 6);
  scene.add(key);
  const fill = new T.DirectionalLight(0xbcd2ff, 1.1);
  fill.position.set(3, -2, -4);
  scene.add(fill);

  type BracketItem = { group: THREE.Group; geo: THREE.BufferGeometry; mat: THREE.MeshStandardMaterial; config: BracketConfig };
  const bracketItems: BracketItem[] = [];
  // The 3D lockup that fades in on the footer settle (loaded async, below).
  let logoBuild: LogoBuild | null = null;

  // Half-extents of the viewport in world units at the shapes' depth.
  let halfW = 4;
  let halfH = 3;
  function measure() {
    const vFov = (camera.fov * Math.PI) / 180;
    halfH = Math.tan(vFov / 2) * camera.position.z;
    halfW = halfH * camera.aspect;
  }
  measure();

  const tmpColor = new T.Color();
  // Built here rather than at module scope: THREE.Color needs the library,
  // and the library only exists once the dynamic import has resolved.
  const paletteStops = PALETTE_STOPS_HEX.map((h) => new T.Color(h));
  const SETTLE_COLOR = new T.Color(SETTLE_COLOR_HEX);

  function apply(
    scrollY: number,
    vh: number,
    vw: number,
    maxScroll: number,
    widen: number,
    settle: number,
    logo: DOMRect | null,
  ) {
    const p = clamp(scrollY / maxScroll); // whole-page 0..1 (colour + bracket tumble)
    const reveal = clamp((scrollY - vh * 0.12) / (vh * 0.6));

    // Settle only kicks in when there is a logo to land on.
    const settleOn = logo ? settle : 0;
    // Half-extents of the frame at the settle plane (z = 0), and px→world
    // scale for the logo box, precomputed once for both brackets.
    const tanHalfFov = Math.tan((camera.fov * Math.PI) / 180 / 2);
    const halfH0 = tanHalfFov * camera.position.z;
    const halfW0 = halfH0 * camera.aspect;
    const sPx = logo ? logo.width / WO_VBW : 0;

    // --- Brackets: revolve around the centre, spin on their own axis, and
    // spread apart as you scroll — then the settle below reels them in onto the
    // logo. The pair share one orbit a half-turn apart (so they stay opposite
    // and their gap only grows), and spin in opposite directions. All a pure
    // function of scroll `p`.
    for (const { group, mat, config } of bracketItems) {
      const s = config.seed;
      const angle = config.baseAngle + p * BRACKET_REVOLVE;
      // Orbit radius grows with scroll (they move farther apart), a touch wider
      // mid-section. Capped under the frame half-extents so they stay in view.
      const rGrow = 0.4 + 0.5 * p + 0.08 * widen;
      const orbitX = Math.cos(angle) * halfW * 0.9 * rGrow;
      const orbitY = Math.sin(angle) * halfH * 0.62 * rGrow;
      // Enter from the side: blend from parked off-screen into the orbit.
      const parkedX = config.side * (halfW + 1.6);
      const driftX = parkedX + (orbitX - parkedX) * reveal;
      const driftY = orbitY * reveal;
      const driftZ = -1 + Math.sin(p * Math.PI * 2 + s) * 1.1;
      const driftScale = 0.55 + 0.45 * reveal;
      // Own-axis spin (opposite per bracket) + a little cross-axis tumble.
      const driftRotZ = p * BRACKET_SPIN * config.spinDir + s;
      const driftRotY = p * BRACKET_SPIN * 0.55 * config.spinDir;
      const driftRotX = Math.sin(p * Math.PI * 2 + s) * 0.4;

      if (settleOn > 0 && logo) {
        // Settled transform: land flat, facing the camera, on the logo slot.
        const cxWo = config.side === -1 ? SETTLE_LEFT_CX : SETTLE_RIGHT_CX;
        const sx = logo.left + cxWo * sPx; // wo x=0 → logo.left
        const sy = logo.top + SETTLE_CY * sPx;
        const settleX = (((sx / vw) * 2 - 1) * halfW0 - driftX) * settleOn + driftX;
        const settleY = ((1 - (sy / vh) * 2) * halfH0 - driftY) * settleOn + driftY;
        const settleScale =
          (((SETTLE_BRACKET_H * sPx) / vh) * 2 * halfH0) / BRACKET_HEIGHT;
        group.position.x = settleX;
        group.position.y = settleY;
        group.position.z = driftZ + (0 - driftZ) * settleOn;
        group.scale.setScalar(driftScale + (settleScale - driftScale) * settleOn);
        group.rotation.x = driftRotX * (1 - settleOn);
        group.rotation.y = driftRotY * (1 - settleOn);
        group.rotation.z = driftRotZ * (1 - settleOn);
        colorAt(p + config.colorOffset, tmpColor, paletteStops);
        tmpColor.lerp(SETTLE_COLOR, settleOn);
        mat.color.copy(tmpColor);
      } else {
        group.position.x = driftX;
        group.position.y = driftY;
        group.position.z = driftZ;
        group.scale.setScalar(driftScale);
        group.rotation.y = driftRotY;
        group.rotation.x = driftRotX;
        group.rotation.z = driftRotZ;
        colorAt(p + config.colorOffset, tmpColor, paletteStops);
        mat.color.copy(tmpColor);
      }
    }

    // --- Footer logo: fade the 3D lockup onto the live footer-logo box -----
    if (logoBuild) {
      if (settleOn > 0.01 && logo) {
        const cxPx = logo.left + logo.width / 2;
        const cyPx = logo.top + logo.height / 2;
        logoBuild.group.visible = true;
        logoBuild.group.position.set(
          ((cxPx / vw) * 2 - 1) * halfW0,
          (1 - (cyPx / vh) * 2) * halfH0,
          0,
        );
        // Built to height 1, so scale = the box's world height.
        logoBuild.group.scale.setScalar(((logo.height / vh) * 2 * halfH0) || 0.001);
        for (const m of logoBuild.mats) m.opacity = settleOn;
      } else {
        logoBuild.group.visible = false;
      }
    }
  }

  // Load every shape from /public and build its meshes. Async, so the scene
  // fills in as files arrive; renders that happen before then just draw empty.
  const loader = new Loader();
  const loadPaths = (file: string) =>
    new Promise<SvgPaths>((resolve) => {
      loader.load(SHAPE_BASE + file, (data) => resolve(data.paths), undefined, () => resolve([]));
    });

  const material = () =>
    new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.42, metalness: 0.15, side: T.DoubleSide });

  (async () => {
    for (const config of BRACKETS) {
      const paths = await loadPaths(config.file);
      if (disposed) return;
      const geo = buildGeometry(T, paths, BRACKET_HEIGHT, VIEWBOX_H[config.file]);
      const mat = material();
      const group = new T.Group();
      group.add(new T.Mesh(geo, mat));
      scene.add(group);
      bracketItems.push({ group, geo, mat, config });
    }

    // Brackets are built and three.js has finished downloading: the visible
    // backdrop is ready, so release the preloader from waiting on 3D. (The
    // footer logo below only matters at the page bottom — don't hold the
    // reveal on it.)
    if (!disposed) {
      measure();
      renderNow();
      markReady(BRACKETS_READY);
    }

    // The footer lockup, extruded like the brackets. Built to world height 1;
    // apply() scales it to the live footer-logo box on settle. Loaded by full
    // path (loadPaths prefixes the brand-shapes dir).
    const logoPaths = await new Promise<SvgPaths>((resolve) => {
      loader.load(LOGO_FILE, (data) => resolve(data.paths), undefined, () => resolve([]));
    });
    if (disposed) return;
    logoBuild = buildLogo(T, logoPaths, 1);
    scene.add(logoBuild.group);

    if (disposed) return;
    measure();
    renderNow();
  })();

  // The homepage's content sections; the bracket sweep widens while the
  // viewport centre sits deep inside one. Re-read on resize (layout shifts).
  let sectionEls = Array.from(document.querySelectorAll<HTMLElement>("main section"));
  function sectionWiden(vh: number) {
    const midY = vh * 0.5;
    let best = 0;
    for (const el of sectionEls) {
      const r = el.getBoundingClientRect();
      if (r.height < 1 || midY < r.top || midY > r.bottom) continue;
      const centered = 1 - Math.min(1, Math.abs(midY - (r.top + r.height / 2)) / (r.height / 2));
      if (centered > best) best = centered;
    }
    return best * best * (3 - 2 * best); // smoothstep, so the widening eases
  }

  // The footer logo the brackets settle onto (id set in FooterLogo). Looked
  // up lazily — the footer lives in the layout, so it is present, but this
  // effect can run before it is queryable on the very first paint.
  let logoEl: HTMLElement | null = null;

  // Render on scroll (and resize) only — never on a clock. Lenis fires a
  // scroll event every frame while it's animating, so this stays smooth, and
  // the page is free to go idle the moment scrolling stops.
  function renderNow() {
    if (disposed) return;
    const vh = window.innerHeight || 1;
    const vw = window.innerWidth || 1;
    const scrollY = window.scrollY;
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - vh);

    // Settle ramps over the last ~0.85 viewport of scroll, easing to 1 at the
    // very bottom where the footer logo comes to rest — except in "settled"
    // mode, which skips the ramp and stays at 1 always (see mount()'s doc
    // comment).
    let settle: number;
    if (mode === "settled") {
      settle = 1;
    } else {
      const raw = clamp(1 - (maxScroll - scrollY) / (vh * 0.85));
      settle = raw * raw * (3 - 2 * raw); // smoothstep
    }
    let logoRect: DOMRect | null = null;
    if (settle > 0) {
      if (!logoEl) logoEl = document.getElementById("footer-logo");
      const r = logoEl?.getBoundingClientRect();
      if (r && r.width > 0) logoRect = r;
    }

    apply(scrollY, vh, vw, maxScroll, sectionWiden(vh), settle, logoRect);
    renderer.render(scene, camera);
  }

  let pending = false;
  function scheduleRender() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      renderNow();
    });
  }

  renderNow();
  window.addEventListener("scroll", scheduleRender, { passive: true });

  function onResize() {
    camera.aspect = host.clientWidth / host.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(host.clientWidth, host.clientHeight);
    measure();
    sectionEls = Array.from(document.querySelectorAll<HTMLElement>("main section"));
    renderNow();
  }
  window.addEventListener("resize", onResize);

  return () => {
    disposed = true;
    window.removeEventListener("scroll", scheduleRender);
    window.removeEventListener("resize", onResize);
    bracketItems.forEach(({ geo, mat }) => {
      geo.dispose();
      mat.dispose();
    });
    logoBuild?.geos.forEach((g) => g.dispose());
    logoBuild?.mats.forEach((m) => m.dispose());
    renderer.dispose();
    if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
  };
}

/**
 * Every route that mounts <BracketsField/> — the single source of truth
 * FooterLogo.tsx and FooterBrackets.tsx both check to decide whether the 3D
 * field is going to provide the footer's brackets/logo itself, or whether
 * they need to fall back to the flat SVG pair. Keeping this list in one
 * place (rather than each of those three files hardcoding its own pathname
 * check) is what stops a new route like this one from silently getting
 * doubled-up brackets — the flat pair rendering on top of a 3D pair that's
 * already there.
 */
export const BRACKETS_FIELD_ROUTES = ["/", "/tickets", "/agenda"];

export function BracketsField({ mode = "scroll" }: { mode?: "scroll" | "settled" } = {}) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    // No WebGL under reduced-motion / lite / save-data — the black layer alone
    // stays as the static backdrop, and three.js is never fetched at all.
    if (!host || shouldUseStaticBaseline()) return;

    let cancelled = false;
    let teardown: (() => void) | undefined;

    void Promise.all([import("three"), import("three/addons/loaders/SVGLoader.js")])
      .then(([T, { SVGLoader }]) => {
        // The effect may already have been cleaned up while this was in flight.
        if (cancelled) return;
        teardown = mount(host, T, SVGLoader, mode);
      })
      .catch(() => {
        // three failed to load (offline chunk, etc.). Release the preloader
        // anyway — it must never be trapped waiting on the 3D backdrop — but
        // release it as a FAILURE, not as success.
        //
        // This is the same dynamic import CurvedMarqueeHero uses, so if it
        // failed here the hero's WebGL cannot render either. Reporting it lets
        // useAssetsLoaded hand off to StaticHero instead of to a blank canvas.
        // It over-triggers slightly (an SVGLoader-only failure would still
        // leave the marquee working) and that is the safe direction to err.
        markFailed(BRACKETS_READY);
      });

    return () => {
      cancelled = true;
      teardown?.();
    };
  }, [mode]);

  // Fixed, full-viewport — the single background the whole page shares. Its
  // colour is var(--page-bg): dark by default, falling back to the --ink
  // greyscale, which VenueReveal scrubs dark → light on scroll (see there).
  // Behind all content (z-0); content sits above via a z-10 wrapper.
  // Opacity reads --brackets-opacity, which a section can scrub to 0 while it's
  // in view (see VenueReveal) if it needs the area behind it fully clear.
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 bg-page-bg"
      style={{ opacity: "var(--brackets-opacity)" }}
    >
      <div ref={hostRef} className="absolute inset-0" />
    </div>
  );
}
