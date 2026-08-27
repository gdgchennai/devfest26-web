"use client";

import { useEffect, useRef } from "react";
// Type-only: erased at build, so it costs nothing in the bundle. The runtime
// namespace is pulled in per-effect via `await import("three")` below.
import type * as THREE from "three";
import type { Font } from "three/addons/loaders/FontLoader.js";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { archivePhotos } from "@/lib/content";
import { isLowPowerDevice, prefersReducedMotion, shouldSkipHeavyAssets } from "@/lib/motion-prefs";
import { RollingText } from "@/components/motion/RollingText";
import { heroCopy } from "@/components/motion/HeroCopy";
import { optimizedSrc } from "@/components/motion/useAssetsLoaded";
import { GlowButton } from "@/components/GlowButton";
import { uiCopy } from "@/site.config";

gsap.registerPlugin(ScrollTrigger);

/* ------------------------------------------------------------------ *
 * A 3D curved image slider, ported from the reference WebGL technique
 * (makedreamwebsite 3D curved slider). Each photo is a subdivided plane
 * whose height is stretched by a parabola of its distance from centre —
 * a real geometry BEND, not a rotated flat card — so the strip curves
 * like a panorama and scrolls continuously behind the title.
 * ------------------------------------------------------------------ */

/**
 * Texture width. Must be one of Next's `deviceSizes` or the optimizer rejects
 * it. The planes render roughly 300–400 CSS px wide at a 1440 viewport, so 1200
 * is ~3× oversampled at 1x and still comfortable on a 2x display — and the
 * strip is a moving, bent, dark-overlaid backdrop, not a gallery.
 */
const TEXTURE_WIDTH = 1200;

/**
 * The exact URLs this component will hand to TextureLoader — exported so the
 * preloader can warm THESE, not something merely equivalent.
 *
 * This export is the guardrail. The preloader is only useful if it warms the
 * identical URL the consumer later requests; when the two drift, the dots bounce
 * on a file nothing wants and then hand off to a hero that still has to fetch —
 * which has already been the bug here twice. A shared helper is not enough, since
 * two call sites can still pass different widths. One array, owned by the
 * consumer, imported by the warmer: drift becomes impossible rather than
 * discouraged.
 *
 * These were raw originals until it was measured: 8 files at 230–505 KB each,
 * warmed as part of ~5 MB on the default path. TextureLoader is just an <img>
 * underneath, so it reads an optimizer URL fine and still gets AVIF/WebP by
 * content negotiation — 86% smaller, same picture.
 */
export const MARQUEE_TEXTURES = archivePhotos
  .slice(0, 8)
  .map((p) => optimizedSrc(p.src, TEXTURE_WIDTH));

/** Marquee speed, inter-plane gap (%), bend strength, scroll direction. */
const OPTS = { speed: 22, gap: 24, curve: 14, direction: -1 };

/** Below this viewport width the marquee planes render larger — small photos
 *  read as illegible confetti on phones, so mobile trades plane count for size. */
const MOBILE_BREAKPOINT = 640;
/** How much bigger each plane renders on mobile. */
const MOBILE_PLANE_SCALE = 1.45;

/** Max forward "coin flip" tilt (about the horizontal axis) as the hero scrolls out. */
const SCROLL_FLIP_RAD = (65 * Math.PI) / 180;

const VERTEX_SHADER = /* glsl */ `
  uniform float curve;
  varying vec2 vertexUV;
  void main() {
    vertexUV = uv;
    vec3 newPosition = position;
    // World-space horizontal distance of this vertex from the scene centre.
    float distanceFromCenter = abs(modelMatrix * vec4(position, 1.0)).x;
    // Stretch height by a parabola of that distance — the panoramic bend.
    newPosition.y *= 1.0 + (curve / 100.0) * pow(distanceFromCenter, 2.0);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D tex;
  uniform float texAspect;  // image width / height
  uniform float planeAspect; // plane width / height (1.0, square)
  varying vec2 vertexUV;
  void main() {
    // Cover-crop so landscape photos fill the plane without distortion.
    vec2 uv = vertexUV;
    float r = texAspect / planeAspect;
    if (r > 1.0) uv.x = (uv.x - 0.5) / r + 0.5;
    else uv.y = (uv.y - 0.5) * r + 0.5;
    gl_FragColor = texture2D(tex, uv);
  }
`;

const planeStep = () => 1 + OPTS.gap / 100;

export function CurvedMarqueeHero() {
  const sectionRef = useRef<HTMLElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const view: HTMLDivElement = containerRef.current;
    // Lite mode / Save-Data / 2G must not pay for three.js at all. Reduced
    // motion is deliberately NOT part of this test — see shouldSkipHeavyAssets:
    // those visitors still get the strip, just rendered once instead of driven
    // by rAF, which is what the `reduce` branches below already do.
    if (shouldSkipHeavyAssets()) return;
    const reduce = prefersReducedMotion();

    let disposed = false;
    let teardown: (() => void) | undefined;

    void (async () => {
      // three.js is fetched on demand so it lands in its own chunk rather than
      // the homepage's initial JS. This is the "Loading External Libraries"
      // pattern from the Next lazy-loading guide; next/dynamic is not usable
      // here because app/page.tsx is a Server Component, and Next does not
      // code-split Client Components dynamically imported from one.
      const T = await import("three");
      // The effect may already have been cleaned up while this was in flight.
      if (disposed) return;

      const scene = new T.Scene();
      const camera = new T.PerspectiveCamera(75, view.clientWidth / view.clientHeight, 0.1, 20);
      camera.position.z = 2;

      const lowPower = isLowPowerDevice();
      const renderer = new T.WebGLRenderer({ alpha: true, antialias: !lowPower });
      renderer.setSize(view.clientWidth, view.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, lowPower ? 1 : 2));
      view.appendChild(renderer.domElement);

      const geometry = new T.PlaneGeometry(1, 1, lowPower ? 8 : 20, lowPower ? 8 : 20);
      const loader = new T.TextureLoader();
      const slideAmount = MARQUEE_TEXTURES.length;

      let planes: THREE.Mesh[] = [];
      let materials: THREE.ShaderMaterial[] = [];
      let textures: THREE.Texture[] = [];
      // Tracks the scale `build()` last used, so `animate()`'s loop-reset
      // threshold (a world-space distance) stays in sync with the actual
      // mesh spacing on mobile instead of assuming desktop's unscaled step.
      let currentPlaneScale = 1;

      // Pixels per world-unit at z = 0, so a 1-unit plane spans a predictable
      // fraction of the container — how the reference sizes/spaces its planes.
      function pixelsPerUnit() {
        const vFov = (camera.fov * Math.PI) / 180;
        const worldH = 2 * Math.tan(vFov / 2) * camera.position.z;
        const worldW = worldH * (view.clientWidth / view.clientHeight);
        return view.clientWidth / worldW;
      }

      function disposePlanes() {
        planes.forEach((p) => scene.remove(p));
        materials.forEach((m) => m.dispose());
        textures.forEach((t) => t.dispose());
        planes = [];
        materials = [];
        textures = [];
      }

      function build() {
        disposePlanes();
        const planeScale = view.clientWidth < MOBILE_BREAKPOINT ? MOBILE_PLANE_SCALE : 1;
        currentPlaneScale = planeScale;
        const step = planeStep() * planeScale;
        const planeSpacePx = pixelsPerUnit() * step;
        // Enough duplicated planes to fill the width plus a buffer, so the loop
        // wraps seamlessly.
        const total = Math.ceil(view.clientWidth / planeSpacePx) + 1 + slideAmount;
        const initialOffset = Math.ceil(view.clientWidth / (2 * planeSpacePx) - 0.5);

        for (let i = 0; i < total; i += 1) {
          const src = MARQUEE_TEXTURES[i % slideAmount];
          loader.load(src, (texture) => {
            // A texture can still arrive after teardown; dropping it here stops
            // it being added to a scene whose renderer is already disposed.
            if (disposed) {
              texture.dispose();
              return;
            }
            // Deliberately NOT setting texture.colorSpace: this custom
            // ShaderMaterial outputs texture samples straight to the canvas with
            // no sRGB re-encode, so decoding the texture to linear (which
            // colorSpace=SRGB does) would render the photos dark/low-contrast.
            // Leaving it as-is passes the sRGB bytes through, matching the source.
            const img = texture.image as { width: number; height: number };
            const material = new T.ShaderMaterial({
              uniforms: {
                tex: { value: texture },
                curve: { value: OPTS.curve },
                texAspect: { value: img.width / img.height },
                planeAspect: { value: 1 },
              },
              vertexShader: VERTEX_SHADER,
              fragmentShader: FRAGMENT_SHADER,
              transparent: true,
            });
            const mesh = new T.Mesh(geometry, material);
            mesh.scale.set(planeScale, planeScale, 1);
            mesh.position.x = -OPTS.direction * (i - initialOffset) * step;
            scene.add(mesh);
            planes.push(mesh);
            materials.push(material);
            textures.push(texture);
            if (reduce) renderer.render(scene, camera); // static: draw as textures arrive
          });
        }
      }

      build();

      // Scroll-driven forward flip: as the hero scrolls out, tilt the WHOLE
      // carousel about its horizontal axis like a coin flipping forward, up to
      // SCROLL_FLIP_RAD. The marquee keeps running underneath it.
      let flip = 0;
      const trigger = reduce
        ? null
        : ScrollTrigger.create({
            trigger: sectionRef.current ?? view,
            start: "top top",
            end: "bottom top",
            scrub: 1,
            onUpdate: (self) => {
              flip = self.progress;
            },
          });

      let raf = 0;
      let time = 0;
      let prev = performance.now();
      function animate(now: number) {
        const dt = now - prev;
        prev = now;
        // Loop when the scene has travelled one full set of unique images.
        if (Math.abs(scene.position.x) >= planeStep() * currentPlaneScale * slideAmount) time = 0;
        time += OPTS.direction * dt * 0.00001;
        scene.position.x = time * OPTS.speed;
        scene.rotation.x = flip * SCROLL_FLIP_RAD;
        renderer.render(scene, camera);
        raf = requestAnimationFrame(animate);
      }
      // This loop otherwise runs forever at 60fps for the lifetime of the page,
      // even once the hero has scrolled far out of view — pure GPU cost with
      // nothing on screen to show for it, and the single biggest source of the
      // "feels heavy" reports on weaker devices. An IntersectionObserver stops
      // it the moment the strip leaves the viewport and restarts it when it
      // scrolls back in.
      function startLoop() {
        if (reduce || raf) return;
        prev = performance.now();
        raf = requestAnimationFrame(animate);
      }
      function stopLoop() {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      const visibility = reduce
        ? null
        : new IntersectionObserver(
            ([entry]) => {
              if (entry.isIntersecting) startLoop();
              else stopLoop();
            },
            { rootMargin: "200px 0px" },
          );
      visibility?.observe(sectionRef.current ?? view);
      if (!reduce) startLoop();

      function onResize() {
        camera.aspect = view.clientWidth / view.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(view.clientWidth, view.clientHeight);
        build();
      }
      window.addEventListener("resize", onResize);

      teardown = () => {
        stopLoop();
        visibility?.disconnect();
        trigger?.kill();
        window.removeEventListener("resize", onResize);
        disposePlanes();
        geometry.dispose();
        renderer.dispose();
        if (renderer.domElement.parentNode === view) view.removeChild(renderer.domElement);
      };
    })();

    return () => {
      disposed = true;
      teardown?.();
    };
  }, []);

  // ---- The title as real extruded 3D text (its own WebGL layer, above the
  // slider) so it reads as a solid object popping off the background. ----
  useEffect(() => {
    if (!textRef.current) return;
    const host: HTMLDivElement = textRef.current;
    // Same bandwidth gate as the strip above — this layer is the other half of
    // the three.js payload (it pulls the FontLoader/TextGeometry addons too).
    if (shouldSkipHeavyAssets()) return;

    let disposed = false;
    let teardown: (() => void) | undefined;

    void (async () => {
      // The addons are separate entry points, so they are fetched alongside the
      // core namespace rather than through it.
      const [T, { FontLoader }, { TextGeometry }] = await Promise.all([
        import("three"),
        import("three/addons/loaders/FontLoader.js"),
        import("three/addons/geometries/TextGeometry.js"),
      ]);
      if (disposed) return;

      const scene = new T.Scene();
      const camera = new T.PerspectiveCamera(40, host.clientWidth / host.clientHeight, 0.1, 100);
      const lowPower = isLowPowerDevice();
      const renderer = new T.WebGLRenderer({ alpha: true, antialias: !lowPower });
      renderer.setSize(host.clientWidth, host.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, lowPower ? 1 : 2));
      host.appendChild(renderer.domElement);

      // Lights shape the bevels — that shading is what sells "solid 3D".
      scene.add(new T.AmbientLight(0xffffff, 0.75));
      const key = new T.DirectionalLight(0xffffff, 3);
      key.position.set(-3, 4, 6);
      scene.add(key);
      const fill = new T.DirectionalLight(0xffffff, 0.9);
      fill.position.set(4, -1, 3);
      scene.add(fill);
      const rim = new T.DirectionalLight(0x5b8cff, 1.1); // brand-blue edge glow
      rim.position.set(0, 2, -5);
      scene.add(rim);

      // Group rather than a single mesh: on mobile the title splits into two
      // stacked line-meshes so it can render bigger in the narrower width;
      // desktop keeps the one-line group so the rest of the logic (fit,
      // rotation, disposal) doesn't need to branch.
      let group: THREE.Group | null = null;
      let geometries: THREE.BufferGeometry[] = [];
      let material: THREE.Material | null = null;
      let loadedFont: Font | null = null;
      let lastIsMobile: boolean | null = null;

      const render = () => renderer.render(scene, camera);

      // Frame the text so it spans most of the width AND height, whatever the
      // viewport — height matters here because the mobile two-line layout is
      // taller than it is wide, unlike the single-line desktop title.
      function fit() {
        if (!group) return;
        const box = new T.Box3().setFromObject(group);
        const w = box.max.x - box.min.x;
        const h = box.max.y - box.min.y;
        const aspect = host.clientWidth / host.clientHeight;
        const vFov = (camera.fov * Math.PI) / 180;
        const fillFracW = aspect < 0.9 ? 0.92 : 0.8; // portrait phones: allow wider
        const fillFracH = 0.82;
        const zFromWidth = w / fillFracW / (2 * Math.tan(vFov / 2) * aspect);
        const zFromHeight = h / fillFracH / (2 * Math.tan(vFov / 2));
        camera.position.set(0, 0, Math.max(zFromWidth, zFromHeight));
        camera.lookAt(0, 0, 0);
        camera.aspect = aspect;
        camera.updateProjectionMatrix();
      }

      function makeLineGeometry(text: string, font: Font) {
        return new TextGeometry(text, {
          font,
          size: 1,
          depth: 0.32,
          curveSegments: 8,
          bevelEnabled: true,
          bevelThickness: 0.05,
          bevelSize: 0.035,
          bevelSegments: 4,
        });
      }

      // (Re)builds the title group for the current viewport. Called once the
      // font is ready, and again on resize if mobile-ness flips, so a phone
      // rotated to landscape (or a desktop window narrowed past the
      // breakpoint) gets the right layout rather than a stale one.
      function buildText() {
        if (!loadedFont || disposed) return;
        if (group) scene.remove(group);
        geometries.forEach((g) => g.dispose());
        geometries = [];

        const isMobile = host.clientWidth < MOBILE_BREAKPOINT;
        lastIsMobile = isMobile;
        if (!material) {
          material = new T.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.38, metalness: 0.12 });
        }

        group = new T.Group();
        const words = heroCopy.title.split(" ");
        // Two lines on mobile so each word can render bigger in the narrower
        // width; falls back to one line if the title is a single word.
        const lines = isMobile && words.length > 1 ? [words[0], words.slice(1).join(" ")] : [heroCopy.title];
        const lineGap = 1.15;
        const startY = ((lines.length - 1) * lineGap) / 2;
        lines.forEach((line, i) => {
          const geo = makeLineGeometry(line, loadedFont!);
          geo.center();
          geometries.push(geo);
          const lineMesh = new T.Mesh(geo, material!);
          lineMesh.position.y = startY - i * lineGap;
          group!.add(lineMesh);
        });

        // Held at a fixed slight angle so the extruded sides stay visible —
        // the text reads as a solid 3D object without moving.
        group.rotation.set(-0.04, 0.17, 0);
        scene.add(group);
        fit();
        render();
      }

      new FontLoader().load("/fonts/google-sans-bold.typeface.json", (font) => {
        if (disposed) return;
        loadedFont = font;
        buildText();
      });

      function onResize() {
        renderer.setSize(host.clientWidth, host.clientHeight);
        if ((host.clientWidth < MOBILE_BREAKPOINT) !== lastIsMobile) {
          buildText();
        } else {
          fit();
          render();
        }
      }
      window.addEventListener("resize", onResize);

      teardown = () => {
        window.removeEventListener("resize", onResize);
        if (group) scene.remove(group);
        geometries.forEach((g) => g.dispose());
        material?.dispose();
        renderer.dispose();
        if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
      };
    })();

    return () => {
      disposed = true;
      teardown?.();
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative flex min-h-[100vh] flex-col items-center justify-center overflow-hidden"
    >
      {/* The strip/title/darken group renders vertically centred by the
          WebGL camera math, which on a phone's tall aspect leaves a bigger
          black gap above the strip than below (the CTAs already occupy the
          space below). max-sm shifts all three layers up together, mobile
          only, so the composition sits higher without re-deriving the
          camera framing itself. */}
      {/* WebGL canvas mounts here — the curved, bending photo strip. */}
      <div ref={containerRef} className="pointer-events-none absolute inset-0 max-sm:-translate-y-[8%]" />

      {/* Soft radial hint behind the title — just enough to lift the wordmark
          off the photos; legibility mostly comes from the text-shadow so the
          images stay bright. */}
      <div
        className="pointer-events-none absolute inset-0 z-[5] max-sm:-translate-y-[8%]"
        style={{
          background:
            "radial-gradient(ellipse 55% 30% at 50% 50%, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.1) 48%, rgba(0,0,0,0) 76%)",
        }}
      />

      {/* The title as extruded 3D text (WebGL), above the strip and the darken.
          An sr-only heading carries the same text for assistive tech. */}
      <div ref={textRef} className="pointer-events-none absolute inset-0 z-10 max-sm:-translate-y-[8%]" />
      <h1 className="sr-only">{heroCopy.title}</h1>

      {/* Calls to action. Labels and destinations come from heroCopy so this
          hero and StaticHero always say the same thing — and so the ticket CTA
          obeys lib/cta.ts, which is what stopped the rest of the site from
          rendering "Get Tickets" as a link to /agenda. */}
      {/* bottom-[24%] on mobile, not the desktop 16% — the whole strip/title
          composition above shifts up by max-sm:-translate-y-[8%], and the
          CTAs need to move up by roughly that same amount to stay the same
          visual distance below the title rather than opening a gap. */}
      <div
        className="absolute inset-x-0 z-20 flex items-center justify-center gap-10 text-lg text-paper max-sm:bottom-[24%] sm:gap-16 sm:bottom-[16%] sm:text-xl"
      >
        <GlowButton href={heroCopy.ticket.href}>
          <RollingText>{uiCopy.common.getTicketsLabel}</RollingText>
        </GlowButton>
        <GlowButton href={heroCopy.volunteer.href} target="_blank" rel="noreferrer">
          <RollingText>{`${heroCopy.volunteer.label}`}</RollingText>
        </GlowButton>
        {heroCopy.agenda && (
          <GlowButton href={heroCopy.agenda.href}>
            <RollingText>{`${heroCopy.agenda.label}`}</RollingText>
          </GlowButton>
        )}
      </div>
    </section>
  );
}
