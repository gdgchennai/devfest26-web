"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
// Type-only: erased at build, so it costs nothing in the bundle. The runtime
// namespace is pulled in per-effect via `await import("three")` below.
import type * as THREE from "three";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { archivePhotos } from "@/lib/content";
import { prefersReducedMotion, shouldSkipHeavyAssets } from "@/lib/motion-prefs";
import { RollingText } from "@/components/motion/RollingText";
import { heroCopy } from "@/components/motion/HeroCopy";

gsap.registerPlugin(ScrollTrigger);

/* ------------------------------------------------------------------ *
 * A 3D curved image slider, ported from the reference WebGL technique
 * (makedreamwebsite 3D curved slider). Each photo is a subdivided plane
 * whose height is stretched by a parabola of its distance from centre —
 * a real geometry BEND, not a rotated flat card — so the strip curves
 * like a panorama and scrolls continuously behind the title.
 * ------------------------------------------------------------------ */

const IMAGE_SRCS = archivePhotos.slice(0, 8).map((p) => p.src);

/** Marquee speed, inter-plane gap (%), bend strength, scroll direction. */
const OPTS = { speed: 22, gap: 24, curve: 14, direction: -1 };

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

      const renderer = new T.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setSize(view.clientWidth, view.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      view.appendChild(renderer.domElement);

      const geometry = new T.PlaneGeometry(1, 1, 20, 20);
      const loader = new T.TextureLoader();
      const slideAmount = IMAGE_SRCS.length;

      let planes: THREE.Mesh[] = [];
      let materials: THREE.ShaderMaterial[] = [];
      let textures: THREE.Texture[] = [];

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
        const step = planeStep();
        const planeSpacePx = pixelsPerUnit() * step;
        // Enough duplicated planes to fill the width plus a buffer, so the loop
        // wraps seamlessly.
        const total = Math.ceil(view.clientWidth / planeSpacePx) + 1 + slideAmount;
        const initialOffset = Math.ceil(view.clientWidth / (2 * planeSpacePx) - 0.5);

        for (let i = 0; i < total; i += 1) {
          const src = IMAGE_SRCS[i % slideAmount];
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
        if (Math.abs(scene.position.x) >= planeStep() * slideAmount) time = 0;
        time += OPTS.direction * dt * 0.00001;
        scene.position.x = time * OPTS.speed;
        scene.rotation.x = flip * SCROLL_FLIP_RAD;
        renderer.render(scene, camera);
        raf = requestAnimationFrame(animate);
      }
      if (!reduce) raf = requestAnimationFrame(animate);

      function onResize() {
        camera.aspect = view.clientWidth / view.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(view.clientWidth, view.clientHeight);
        build();
      }
      window.addEventListener("resize", onResize);

      teardown = () => {
        cancelAnimationFrame(raf);
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
      const renderer = new T.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setSize(host.clientWidth, host.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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

      let mesh: THREE.Mesh | null = null;
      // Typed as the base class rather than TextGeometry: every call below
      // (center/computeBoundingBox/boundingBox/dispose) is a BufferGeometry
      // member, and this avoids a second type-only import of the addon.
      let geometry: THREE.BufferGeometry | null = null;
      let material: THREE.Material | null = null;

      const render = () => renderer.render(scene, camera);

      // Frame the text so it spans most of the width, whatever the viewport.
      function fit() {
        if (!geometry) return;
        geometry.computeBoundingBox();
        const bb = geometry.boundingBox;
        if (!bb) return;
        const w = bb.max.x - bb.min.x;
        const aspect = host.clientWidth / host.clientHeight;
        const vFov = (camera.fov * Math.PI) / 180;
        const fillFrac = aspect < 0.9 ? 0.92 : 0.8; // portrait phones: allow wider
        const visibleWidth = w / fillFrac;
        camera.position.set(0, 0, visibleWidth / (2 * Math.tan(vFov / 2) * aspect));
        camera.lookAt(0, 0, 0);
        camera.aspect = aspect;
        camera.updateProjectionMatrix();
      }

      new FontLoader().load("/fonts/google-sans-bold.typeface.json", (font) => {
        if (disposed) return;
        geometry = new TextGeometry(heroCopy.title, {
          font,
          size: 1,
          depth: 0.32,
          curveSegments: 8,
          bevelEnabled: true,
          bevelThickness: 0.05,
          bevelSize: 0.035,
          bevelSegments: 4,
        });
        geometry.center();
        material = new T.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.38, metalness: 0.12 });
        mesh = new T.Mesh(geometry, material);
        // Held at a fixed slight angle so the extruded sides stay visible — the
        // text reads as a solid 3D object without moving.
        mesh.rotation.set(-0.04, 0.17, 0);
        scene.add(mesh);
        fit();
        render();
      });

      function onResize() {
        renderer.setSize(host.clientWidth, host.clientHeight);
        fit();
        render();
      }
      window.addEventListener("resize", onResize);

      teardown = () => {
        window.removeEventListener("resize", onResize);
        geometry?.dispose();
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
      {/* WebGL canvas mounts here — the curved, bending photo strip. */}
      <div ref={containerRef} className="pointer-events-none absolute inset-0" />

      {/* Soft radial hint behind the title — just enough to lift the wordmark
          off the photos; legibility mostly comes from the text-shadow so the
          images stay bright. */}
      <div
        className="pointer-events-none absolute inset-0 z-[5]"
        style={{
          background:
            "radial-gradient(ellipse 55% 30% at 50% 50%, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.1) 48%, rgba(0,0,0,0) 76%)",
        }}
      />

      {/* The title as extruded 3D text (WebGL), above the strip and the darken.
          An sr-only heading carries the same text for assistive tech. */}
      <div ref={textRef} className="pointer-events-none absolute inset-0 z-10" />
      <h1 className="sr-only">{heroCopy.title}</h1>

      {/* Calls to action. Labels and destinations come from heroCopy so this
          hero and StaticHero always say the same thing — and so the ticket CTA
          obeys lib/cta.ts, which is what stopped the rest of the site from
          rendering "Get Tickets" as a link to /agenda. */}
      <div
        className="absolute inset-x-0 z-20 flex items-center justify-center gap-10 text-lg text-paper sm:gap-16 sm:text-xl"
        style={{ bottom: "16%" }}
      >
        {heroCopy.ticket.available ? (
          <Link href={heroCopy.ticket.href}>
            <RollingText>{`${heroCopy.ticket.label} →`}</RollingText>
          </Link>
        ) : (
          // Nowhere to go yet, so it is text rather than a link — but it keeps
          // its place in the row so the composition does not shift when the
          // ticketing URL lands.
          <span className="text-paper/70">{heroCopy.ticket.label}</span>
        )}
        <Link href={heroCopy.agenda.href}>
          <RollingText>{`${heroCopy.agenda.label} →`}</RollingText>
        </Link>
      </div>
    </section>
  );
}
