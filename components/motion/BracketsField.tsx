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
import { markReady, BRACKETS_READY } from "@/lib/assetReady";

/** The dynamically-imported three.js namespace, passed to the builders below. */
type Three = typeof import("three");
/** The SVGLoader class itself (its statics are used, not just instances). */
type SvgLoaderCtor = typeof import("three/addons/loaders/SVGLoader.js").SVGLoader;

/* ------------------------------------------------------------------ *
 * The 3D brand-shape backdrop: a FIXED, full-viewport black layer behind
 * the whole page (content scrolls over it). Two things live in it, both
 * built from the brand SVGs (public/brand-shapes) as extruded 3D meshes:
 *
 *  • Two brackets — a sticky pair that hold their place near the edges and
 *    drift/turn gently as you scroll (they never travel up the page).
 *  • A field of smaller shapes (angle, dot, double-slash, plus) that rise
 *    up the frame like parallax as you scroll, flipping/turning and cycling
 *    the brand palette.
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
  "angle.svg": 184,
  "dot.svg": 102,
  "double_slash.svg": 304,
  "small_plus.svg": 169,
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
};

const BRACKETS: BracketConfig[] = [
  { file: "left_bracket.svg", side: -1, seed: 0, colorOffset: 0 },
  { file: "right_bracket.svg", side: 1, seed: 4.7, colorOffset: 0.5 },
];

/** Shapes cycled through the rising parallax field. */
const FLOATER_FILES = ["angle.svg", "dot.svg", "double_slash.svg", "small_plus.svg"];
const FLOATER_COUNT = 24;

/**
 * Smooth pseudo-random value in ~[-1, 1], summed from two low, close, non-
 * harmonic frequencies: enough variety to feel unplanned, but the rate of
 * change stays gentle and even so every channel moves at a similar pace. Pure
 * function of scroll `t` + `seed`, so it's deterministic and scroll-only.
 */
function fbm(t: number, seed: number): number {
  return Math.sin(t * 4.2 + seed * 12.9898) * 0.7 + Math.sin(t * 7.3 + seed * 78.233) * 0.3;
}

const frac = (x: number) => x - Math.floor(x);

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
  Loader: SvgLoaderCtor,
  paths: SvgPaths,
  targetH: number,
  viewBoxH: number,
): THREE.ExtrudeGeometry {
  const shapes = paths.flatMap((p) => Loader.createShapes(p));
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

const LOGO_FILE = "/brand-assets/devfest-logo-wo-brackets.svg";
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
function buildLogo(T: Three, Loader: SvgLoaderCtor, paths: SvgPaths, targetH: number): LogoBuild {
  const byFill = new Map<string, SvgPaths>();
  for (const p of paths) {
    const fill = ((p.userData as { style?: { fill?: string } } | undefined)?.style?.fill ?? "#000").toLowerCase();
    if (fill === "none") continue;
    const list = byFill.get(fill) ?? [];
    list.push(p);
    byFill.set(fill, list);
  }

  const built: { geo: THREE.ExtrudeGeometry; fill: string }[] = [];
  for (const [fill, ps] of byFill) {
    const shapes = ps.flatMap((p) => Loader.createShapes(p));
    if (shapes.length === 0) continue;
    const isPlate = fill === "white" || fill === "#ffffff" || fill === "#fff";
    const depth = LOGO_VBH * (isPlate ? 0.055 : 0.09);
    const geo = new T.ExtrudeGeometry(shapes, {
      depth,
      bevelEnabled: true,
      bevelThickness: LOGO_VBH * 0.004,
      bevelSize: LOGO_VBH * 0.003,
      bevelSegments: 3,
      curveSegments: 16,
    });
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
      roughness: isPlate ? 0.5 : 0.45,
      metalness: isPlate ? 0 : 0.12,
      // A gentle self-lit lift so the pill reads bright, but low enough that the
      // scene lights still shade it and it keeps its 3D form (too high and it
      // flattens into a blank white blob).
      emissive: isPlate ? new T.Color(0xffffff) : new T.Color(0x000000),
      emissiveIntensity: isPlate ? 0.05 : 0,
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
 */
function mount(host: HTMLDivElement, T: Three, Loader: SvgLoaderCtor): () => void {
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
  type FloaterItem = { mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial; i: number };
  const bracketItems: BracketItem[] = [];
  const floaterItems: FloaterItem[] = [];
  const floaterGeos: THREE.BufferGeometry[] = [];
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
    const q = scrollY / vh; // viewports scrolled (parallax rise — uniform)
    const reveal = clamp((scrollY - vh * 0.12) / (vh * 0.6));

    // Settle only kicks in when there is a logo to land on.
    const settleOn = logo ? settle : 0;
    // Half-extents of the frame at the settle plane (z = 0), and px→world
    // scale for the logo box, precomputed once for both brackets.
    const tanHalfFov = Math.tan((camera.fov * Math.PI) / 180 / 2);
    const halfH0 = tanHalfFov * camera.position.z;
    const halfW0 = halfH0 * camera.aspect;
    const sPx = logo ? logo.width / WO_VBW : 0;

    // --- Brackets: hold near the edges, gentle even drift/turn -------------
    const spanFrac = 0.5 + 0.45 * widen; // wider mid-section, tighter at edges
    for (const { group, mat, config } of bracketItems) {
      const s = config.seed;
      const pathX = fbm(p, s + 0.1) * halfW * spanFrac;
      const parkedX = config.side * (halfW + 1.4);
      // Free-drift transform (settle = 0).
      const driftX = parkedX + (pathX - parkedX) * reveal;
      const driftY = fbm(p, s + 2.7) * halfH * (0.4 + 0.4 * widen) * reveal;
      const driftZ = -1 + fbm(p, s + 5.1) * 0.9;
      const driftScale = 0.55 + 0.45 * reveal;
      const driftRotY = fbm(p, s + 7.3) * (0.9 + 0.3 * widen);
      const driftRotX = fbm(p, s + 9.9) * 0.32;
      const driftRotZ = fbm(p, s + 12.4) * 0.32;

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

    // --- Floaters: rise up the frame like parallax and scroll out of view.
    // Each is anchored to a point along the page and travels straight up and
    // off the top as you scroll past it, entering from below. PF > 1 makes them
    // rise FASTER than the page scrolls, so they read as moving up everywhere —
    // including once the page scrolls normally after the pinned "What to expect"
    // section (at PF < 1 the content overtook them and they looked like they
    // reversed). Uniform for all.
    const PF = 1.25; // parallax rise speed relative to the page
    const travel = maxScroll * PF;
    const ROT_RATE = 1.2; // radians turned per viewport
    const COLOR_RATE = 0.15; // palette units per viewport
    for (const { mesh, mat, i } of floaterItems) {
      mesh.visible = true;
      // Push each one back to its own depth, and size the frame to THAT depth
      // so it spans the screen properly rather than clustering near centre.
      const z = -2.2 - frac(i * 0.7311) * 3.5;
      const hH = tanHalfFov * (camera.position.z - z);
      const hW = hH * camera.aspect;

      const fx = (frac(i * 0.618) * 2 - 1) * hW * 0.92;
      // Staggered home, starting below the first screen so nothing sits over
      // the hero; maps px-from-top into world space at this depth.
      const homeY = vh + frac(i * 0.4142 + 0.13) * (travel + vh);
      const clientY = homeY - scrollY * PF;
      const worldY = hH - (clientY / vh) * 2 * hH;
      mesh.position.set(fx, worldY, z);
      mesh.scale.setScalar(0.5 + frac(i * 0.271) * 0.6);

      // Flip about X or Y (alternating), same angular velocity for all.
      const turn = frac(i * 0.911) * Math.PI * 2 + q * ROT_RATE;
      if (i % 2 === 0) mesh.rotation.set(turn, 0.3, 0);
      else mesh.rotation.set(0.3, turn, 0);

      colorAt(q * COLOR_RATE + frac(i * 0.317), tmpColor, paletteStops);
      mat.color.copy(tmpColor);
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
      const geo = buildGeometry(T, Loader, paths, BRACKET_HEIGHT, VIEWBOX_H[config.file]);
      const mat = material();
      const group = new T.Group();
      group.add(new T.Mesh(geo, mat));
      scene.add(group);
      bracketItems.push({ group, geo, mat, config });
    }

    const geoByFile: Record<string, THREE.BufferGeometry> = {};
    for (const file of FLOATER_FILES) {
      const paths = await loadPaths(file);
      if (disposed) return;
      const geo = buildGeometry(T, Loader, paths, 1, VIEWBOX_H[file]);
      geoByFile[file] = geo;
      floaterGeos.push(geo);
    }
    for (let i = 0; i < FLOATER_COUNT; i += 1) {
      const geo = geoByFile[FLOATER_FILES[i % FLOATER_FILES.length]];
      const mat = material();
      const mesh = new T.Mesh(geo, mat);
      mesh.visible = false;
      scene.add(mesh);
      floaterItems.push({ mesh, mat, i });
    }

    // Brackets + floaters are built and three.js has finished downloading: the
    // visible backdrop is ready, so release the preloader from waiting on 3D.
    // (The footer logo below only matters at the page bottom — don't hold the
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
    logoBuild = buildLogo(T, Loader, logoPaths, 1);
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
    // very bottom where the footer logo comes to rest.
    const raw = clamp(1 - (maxScroll - scrollY) / (vh * 0.85));
    const settle = raw * raw * (3 - 2 * raw); // smoothstep
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
    floaterItems.forEach(({ mat }) => mat.dispose());
    floaterGeos.forEach((g) => g.dispose());
    logoBuild?.geos.forEach((g) => g.dispose());
    logoBuild?.mats.forEach((m) => m.dispose());
    renderer.dispose();
    if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
  };
}

export function BracketsField() {
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
        teardown = mount(host, T, SVGLoader);
      })
      .catch(() => {
        // three failed to load (offline chunk, etc.). Release the preloader
        // anyway — it must never be trapped waiting on the 3D backdrop.
        markReady(BRACKETS_READY);
      });

    return () => {
      cancelled = true;
      teardown?.();
    };
  }, []);

  // Fixed, full-viewport — the single background the whole page shares, at the
  // fixed var(--ink). Behind all content (z-0); content sits above via a z-10
  // wrapper.
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 bg-ink">
      <div ref={hostRef} className="absolute inset-0" />
    </div>
  );
}
