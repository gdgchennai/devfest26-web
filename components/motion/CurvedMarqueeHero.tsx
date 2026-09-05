"use client";

import { useEffect, useRef } from "react";
// Type-only: erased at build, so it costs nothing in the bundle. The runtime
// namespace is pulled in per-effect via `await import("three")` below.
import type * as THREE from "three";
import type { Font } from "three/addons/loaders/FontLoader.js";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { gpuQuality } from "@/lib/gpu";
import type { ArchivePhoto } from "@/lib/schemas";
import { prefersReducedMotion, shouldSkipHeavyAssets } from "@/lib/motion-prefs";
import { RollingText } from "@/components/motion/RollingText";
import { heroCopy, heroButtons } from "@/components/motion/HeroCopy";
import { optimizedSrc } from "@/components/motion/useAssetsLoaded";
import { GlowButton } from "@/components/GlowButton";
import { createAlphaRenderer } from "@/lib/webgl";

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
export const MARQUEE_TEXTURE_WIDTH = 1200;
/** Phone-width planes; must be in IMAGE_DEVICE_SIZES. */
const MARQUEE_TEXTURE_WIDTH_NARROW = 750;

export function marqueeTextureWidth(): number {
  if (typeof window === "undefined") return MARQUEE_TEXTURE_WIDTH;
  return window.innerWidth < 640 ? MARQUEE_TEXTURE_WIDTH_NARROW : MARQUEE_TEXTURE_WIDTH;
}

export function marqueeTexturesFrom(photos: ArchivePhoto[]): string[] {
  const width = marqueeTextureWidth();
  return photos.slice(0, 8).map((p) => optimizedSrc(p.src, width));
}

/** Marquee speed, inter-plane gap (%), bend strength, scroll direction. */
const OPTS = { speed: 22, gap: 24, curve: 14, direction: -1 };

/** Below this viewport width the marquee planes render larger — small photos
 *  read as illegible confetti on phones, so mobile trades plane count for size. */
const MOBILE_BREAKPOINT = 640;
/** How much bigger each plane renders on mobile. */
const MOBILE_PLANE_SCALE = 1.45;

/** Tamil lockup shown on the back of the Chennai line after a click-flip. */
const CHENNAI_TAMIL = "சென்னை";
/** Shaped word stored as one PUA glyph — see scripts/build-tamil-typeface.mjs. */
const TAMIL_TYPEFACE = "/fonts/noto-sans-tamil-chennai.typeface.json";
const TAMIL_GLYPH = "\uE000";
/** Google red on the “ai” of Chennai (matches --red). */
const GOOGLE_RED = 0xea4335;

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

export function CurvedMarqueeHero({ photos, paused = false }: { photos: ArchivePhoto[]; paused?: boolean }) {
  const urls = marqueeTexturesFrom(photos);
  const sectionRef = useRef<HTMLElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const loopRef = useRef<{ start: () => void; stop: () => void; intersecting: boolean } | null>(null);

  useEffect(() => {
    const loop = loopRef.current;
    if (!loop) return;
    if (paused) loop.stop();
    else if (loop.intersecting) loop.start();
  }, [paused]);

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
      const T = await import("three");
      if (disposed) return;

      const scene = new T.Scene();
      const camera = new T.PerspectiveCamera(75, view.clientWidth / view.clientHeight, 0.1, 20);
      camera.position.z = 2;

      const quality = gpuQuality();
      const renderer = createAlphaRenderer(T.WebGLRenderer, view, {
        pixelRatio: quality.pixelRatio,
        antialias: quality.antialias,
      });

      const segs = quality.antialias || quality.pixelRatio > 1 ? 20 : 8;
      const geometry = new T.PlaneGeometry(1, 1, segs, segs);
      const loader = new T.TextureLoader();
      const slideAmount = urls.length;

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
          const src = urls[i % slideAmount];
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
      // scrolls back in. The intro overlay also pauses it (see `paused`) so
      // the bouncing loader isn't competing with a hidden WebGL strip.
      function startLoop() {
        if (reduce || raf || pausedRef.current) return;
        prev = performance.now();
        raf = requestAnimationFrame(animate);
      }
      function stopLoop() {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      const loop = { start: startLoop, stop: stopLoop, intersecting: true };
      loopRef.current = loop;
      const visibility = reduce
        ? null
        : new IntersectionObserver(
            ([entry]) => {
              loop.intersecting = entry.isIntersecting;
              if (entry.isIntersecting) startLoop();
              else stopLoop();
            },
            { rootMargin: "200px 0px" },
          );
      visibility?.observe(sectionRef.current ?? view);
      if (!reduce && !pausedRef.current) startLoop();

      function onResize() {
        camera.aspect = view.clientWidth / view.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(view.clientWidth, view.clientHeight);
        build();
      }
      window.addEventListener("resize", onResize);

      teardown = () => {
        stopLoop();
        loopRef.current = null;
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
      const quality = gpuQuality();
      const renderer = createAlphaRenderer(T.WebGLRenderer, host, {
        pixelRatio: quality.pixelRatio,
        antialias: quality.antialias,
      });

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

      // Group of per-line meshes (DevFest / Chennai) so each line can be
      // centered independently. Same layout at every width — desktop used to
      // stay one line and looked undersized next to the stacked phone title.
      let group: THREE.Group | null = null;
      let chennaiPivot: THREE.Group | null = null;
      let englishFace: THREE.Group | null = null;
      let tamilFace: THREE.Group | null = null;
      let geometries: THREE.BufferGeometry[] = [];
      let extraMaterials: THREE.Material[] = [];
      let paperMat: THREE.MeshStandardMaterial | null = null;
      let aiMat: THREE.MeshStandardMaterial | null = null;
      let loadedFont: Font | null = null;
      let loadedTamilFont: Font | null = null;
      let lastIsMobile: boolean | null = null;
      let raf = 0;
      let pointerX = 0;
      let pointerY = 0;
      let originBeta: number | null = null;
      let originGamma: number | null = null;
      let tamilShown = false;
      let flipping = false;
      let flipTween: gsap.core.Tween | null = null;
      const raycaster = new T.Raycaster();
      const ndc = new T.Vector2();
      const BASE_ROT = { x: -0.04, y: 0.17, z: 0 };
      const POINTER_TILT = 0.22;
      /** Degrees of physical tilt that maps to full pointerX/Y. */
      const GYRO_RANGE = 24;
      const reduceMotion = prefersReducedMotion();
      const followPointer =
        window.matchMedia("(pointer: fine)").matches && !reduceMotion;
      const followGyro =
        window.matchMedia("(pointer: coarse)").matches &&
        !reduceMotion &&
        typeof window.DeviceOrientationEvent !== "undefined";
      const follow = followPointer || followGyro;

      const render = () => renderer.render(scene, camera);

      /** English until the card is edge-on; Tamil only on the far side of the flip. */
      function syncFlipFaces() {
        if (!englishFace || !tamilFace || !chennaiPivot) return;
        const showTamil = Math.cos(chennaiPivot.rotation.y) <= 0;
        englishFace.visible = !showTamil;
        tamilFace.visible = showTamil;
      }

      function tick() {
        if (disposed || !group) return;
        syncFlipFaces();
        const targetX = BASE_ROT.x - pointerY * POINTER_TILT;
        const targetY = BASE_ROT.y + pointerX * POINTER_TILT;
        const targetZ = BASE_ROT.z - pointerX * 0.05;
        group.rotation.x += (targetX - group.rotation.x) * 0.08;
        group.rotation.y += (targetY - group.rotation.y) * 0.08;
        group.rotation.z += (targetZ - group.rotation.z) * 0.08;
        render();
        raf = requestAnimationFrame(tick);
      }

      function needsLoop() {
        return follow;
      }

      function startLoop() {
        if (!needsLoop()) return;
        if (!raf && !document.hidden) raf = requestAnimationFrame(tick);
      }

      function onPointerMove(e: PointerEvent) {
        const rect = host.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        pointerX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        pointerY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
        pointerX = Math.max(-1, Math.min(1, pointerX));
        pointerY = Math.max(-1, Math.min(1, pointerY));
      }

      function onPointerLeave() {
        pointerX = 0;
        pointerY = 0;
        host.style.cursor = "";
        renderer.domElement.style.cursor = "";
      }

      function pointerNdc(e: PointerEvent | MouseEvent) {
        const el = renderer.domElement;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;
        ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        ndc.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
        return true;
      }

      function hitsChennai(e: PointerEvent | MouseEvent) {
        if (!chennaiPivot) return false;
        if (!pointerNdc(e)) return false;
        chennaiPivot.updateWorldMatrix(true, true);
        raycaster.setFromCamera(ndc, camera);
        return raycaster.intersectObject(chennaiPivot, true).length > 0;
      }

      function onHostPointerMove(e: PointerEvent) {
        renderer.domElement.style.cursor = hitsChennai(e) ? "pointer" : "";
      }

      function onHostClick(e: MouseEvent) {
        if (flipping || !chennaiPivot || !hitsChennai(e)) return;
        e.preventDefault();
        flipping = true;
        tamilShown = !tamilShown;
        flipTween?.kill();
        flipTween = gsap.to(chennaiPivot.rotation, {
          y: tamilShown ? Math.PI : 0,
          duration: reduceMotion ? 0.01 : 0.75,
          ease: "power2.inOut",
          onUpdate: () => {
            syncFlipFaces();
            if (!needsLoop()) render();
          },
          onComplete: () => {
            flipping = false;
            syncFlipFaces();
            render();
          },
        });
      }

      function onDeviceOrientation(e: DeviceOrientationEvent) {
        if (e.beta == null || e.gamma == null) return;
        if (originBeta == null || originGamma == null) {
          originBeta = e.beta;
          originGamma = e.gamma;
          return;
        }
        pointerX = Math.max(-1, Math.min(1, (e.gamma - originGamma) / GYRO_RANGE));
        pointerY = Math.max(-1, Math.min(1, -(e.beta - originBeta) / GYRO_RANGE));
      }

      function resetGyroOrigin() {
        originBeta = null;
        originGamma = null;
      }

      function attachGyro() {
        window.addEventListener("deviceorientation", onDeviceOrientation);
        window.addEventListener("orientationchange", resetGyroOrigin);
      }

      function requestGyroPermission() {
        const DOE = window.DeviceOrientationEvent as unknown as {
          requestPermission?: () => Promise<string>;
        };
        if (typeof DOE.requestPermission !== "function") {
          attachGyro();
          return;
        }
        void DOE.requestPermission()
          .then((state) => {
            if (!disposed && state === "granted") attachGyro();
          })
          .catch(() => {
            // Denied or not a trusted gesture — title stays still.
          });
      }

      // Frame the lockup just inside the marquee strip (a 1-unit plane at
      // z=2 / fov 75 is ~33% of the viewport on desktop, ~47% on the
      // scaled phone strip) so it does not cover the CTAs below.
      function fit() {
        if (!group) return;
        const box = new T.Box3().setFromObject(group);
        const w = box.max.x - box.min.x;
        const h = box.max.y - box.min.y;
        const aspect = host.clientWidth / host.clientHeight;
        const vFov = (camera.fov * Math.PI) / 180;
        const fillFracW = aspect < 0.9 ? 0.78 : 0.52;
        const fillFracH = aspect < 0.9 ? 0.4 : 0.36;
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
          curveSegments: quality.antialias || quality.pixelRatio > 1 ? 12 : 8,
          bevelEnabled: true,
          bevelThickness: 0.05,
          bevelSize: 0.035,
          bevelSegments: quality.antialias || quality.pixelRatio > 1 ? 5 : 3,
        });
      }

      function disposeBuilt() {
        geometries.forEach((g) => g.dispose());
        extraMaterials.forEach((m) => m.dispose());
        geometries = [];
        extraMaterials = [];
      }

      function layoutWord(stem: string, glow: string, font: Font, parent: THREE.Group) {
        const stemGeo = makeLineGeometry(stem, font);
        const glowGeo = makeLineGeometry(glow, font);
        stemGeo.computeBoundingBox();
        glowGeo.computeBoundingBox();
        geometries.push(stemGeo, glowGeo);
        const s = stemGeo.boundingBox!;
        const g = glowGeo.boundingBox!;
        const stemW = s.max.x - s.min.x;
        const glowW = g.max.x - g.min.x;
        const gap = 0;
        const total = stemW + gap + glowW;
        const minY = Math.min(s.min.y, g.min.y);
        const maxY = Math.max(s.max.y, g.max.y);
        const midY = (minY + maxY) / 2;
        const stemMesh = new T.Mesh(stemGeo, paperMat!);
        const glowMesh = new T.Mesh(glowGeo, aiMat!);
        stemMesh.position.set(-total / 2 - s.min.x, -midY, 0);
        glowMesh.position.set(-total / 2 + stemW + gap - g.min.x, -midY, 0);
        parent.add(stemMesh, glowMesh);
      }

      // Rebuilds the stacked title. Called once the font is ready, and again
      // on resize if the mobile/desktop line-gap flips.
      function buildText() {
        if (!loadedFont || disposed) return;
        if (group) scene.remove(group);
        disposeBuilt();
        chennaiPivot = null;
        englishFace = null;
        tamilFace = null;

        const isMobile = host.clientWidth < MOBILE_BREAKPOINT;
        lastIsMobile = isMobile;
        if (!paperMat) {
          paperMat = new T.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.38, metalness: 0.12 });
        }
        if (!aiMat) {
          aiMat = new T.MeshStandardMaterial({
            color: GOOGLE_RED,
            roughness: 0.28,
            metalness: 0.18,
            emissive: GOOGLE_RED,
            emissiveIntensity: reduceMotion ? 0 : 0.4,
          });
        }

        group = new T.Group();
        const words = heroCopy.title.split(" ");
        const lines = words.length > 1 ? [words[0], words.slice(1).join(" ")] : [heroCopy.title];
        const lineGap = isMobile ? 1.15 : 1.08;
        const startY = ((lines.length - 1) * lineGap) / 2;
        lines.forEach((line, i) => {
          const y = startY - i * lineGap;
          const glowSplit =
            i === lines.length - 1 && line.toLowerCase().endsWith("ai") && line.length > 2
              ? ([line.slice(0, -2), line.slice(-2)] as const)
              : null;
          if (!glowSplit) {
            const geo = makeLineGeometry(line, loadedFont!);
            geo.center();
            geometries.push(geo);
            const lineMesh = new T.Mesh(geo, paperMat!);
            lineMesh.position.y = y;
            group!.add(lineMesh);
            return;
          }

          const pivot = new T.Group();
          pivot.position.y = y;
          pivot.rotation.y = tamilShown ? Math.PI : 0;
          const english = new T.Group();
          layoutWord(glowSplit[0], glowSplit[1], loadedFont!, english);
          pivot.add(english);

          const ebox = new T.Box3().setFromObject(english);
          const ew = Math.max(0.5, ebox.max.x - ebox.min.x);
          let eh = Math.max(0.4, ebox.max.y - ebox.min.y);
          const tamil = new T.Group();
          tamil.rotation.y = Math.PI;
          if (loadedTamilFont) {
            const tamilGeo = makeLineGeometry(TAMIL_GLYPH, loadedTamilFont);
            tamilGeo.center();
            geometries.push(tamilGeo);
            const tbox = tamilGeo.boundingBox!;
            const tw = Math.max(0.01, tbox.max.x - tbox.min.x);
            const th = Math.max(0.01, tbox.max.y - tbox.min.y);
            const tamilMesh = new T.Mesh(tamilGeo, paperMat!);
            tamilMesh.scale.setScalar(ew / tw);
            tamil.add(tamilMesh);
            eh = Math.max(eh, th * (ew / tw));
          }
          const hitGeo = new T.BoxGeometry(ew * 1.08, eh * 1.25, 0.4);
          const hitMat = new T.MeshBasicMaterial({
            colorWrite: false,
            depthWrite: false,
          });
          geometries.push(hitGeo);
          extraMaterials.push(hitMat);
          const hit = new T.Mesh(hitGeo, hitMat);
          pivot.add(tamil, hit);
          group!.add(pivot);
          chennaiPivot = pivot;
          englishFace = english;
          tamilFace = tamil;
          syncFlipFaces();
        });

        group.rotation.set(BASE_ROT.x, BASE_ROT.y, BASE_ROT.z);
        scene.add(group);
        fit();
        render();
      }

      const loader = new FontLoader();
      const loadFont = (url: string) =>
        new Promise<Font>((resolve, reject) => {
          loader.load(url, resolve, undefined, reject);
        });
      void Promise.all([
        loadFont("/fonts/google-sans-bold.typeface.json"),
        loadFont(TAMIL_TYPEFACE),
      ]).then(([latin, tamil]) => {
        if (disposed) return;
        loadedFont = latin;
        loadedTamilFont = tamil;
        buildText();
        startLoop();
      });

      function onResize() {
        renderer.setSize(host.clientWidth, host.clientHeight);
        if ((host.clientWidth < MOBILE_BREAKPOINT) !== lastIsMobile) {
          buildText();
        } else {
          fit();
          if (!raf) render();
        }
      }
      function onVis() {
        if (document.hidden) {
          if (raf) cancelAnimationFrame(raf);
          raf = 0;
        } else {
          startLoop();
        }
      }

      window.addEventListener("resize", onResize);
      document.addEventListener("visibilitychange", onVis);
      renderer.domElement.style.pointerEvents = "auto";
      renderer.domElement.addEventListener("pointermove", onHostPointerMove, { passive: true });
      renderer.domElement.addEventListener("click", onHostClick);
      if (followPointer) {
        window.addEventListener("pointermove", onPointerMove, { passive: true });
        document.documentElement.addEventListener("mouseleave", onPointerLeave);
        window.addEventListener("blur", onPointerLeave);
      }
      if (followGyro) {
        const DOE = window.DeviceOrientationEvent as unknown as {
          requestPermission?: () => Promise<string>;
        };
        // iOS 13+ only grants this from a user gesture. Capture-phase
        // pointerdown catches the intro tap (and any later tap) once.
        if (typeof DOE.requestPermission === "function") {
          window.addEventListener("pointerdown", requestGyroPermission, { once: true, capture: true });
        } else {
          attachGyro();
        }
      }

      teardown = () => {
        flipTween?.kill();
        window.removeEventListener("resize", onResize);
        document.removeEventListener("visibilitychange", onVis);
        renderer.domElement.removeEventListener("pointermove", onHostPointerMove);
        renderer.domElement.removeEventListener("click", onHostClick);
        if (followPointer) {
          window.removeEventListener("pointermove", onPointerMove);
          document.documentElement.removeEventListener("mouseleave", onPointerLeave);
          window.removeEventListener("blur", onPointerLeave);
        }
        if (followGyro) {
          window.removeEventListener("pointerdown", requestGyroPermission, true);
          window.removeEventListener("deviceorientation", onDeviceOrientation);
          window.removeEventListener("orientationchange", resetGyroOrigin);
        }
        if (raf) cancelAnimationFrame(raf);
        if (group) scene.remove(group);
        disposeBuilt();
        paperMat?.dispose();
        aiMat?.dispose();
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
      className="relative flex min-h-[100vh] min-h-[100dvh] flex-col items-center justify-center overflow-hidden"
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
      <div
        ref={textRef}
        className="absolute inset-0 z-10 max-sm:-translate-y-[8%]"
        style={{ touchAction: "pan-y" }}
      />
      <h1 className="sr-only">{`${heroCopy.title} / ${CHENNAI_TAMIL}`}</h1>

      {/* Calls to action. Labels and destinations come from heroCopy so this
          hero and StaticHero always say the same thing — and so the ticket CTA
          obeys lib/cta.ts, which is what stopped the rest of the site from
          rendering "Get Tickets" as a link to /agenda. */}
      {/* bottom-[24%] on mobile, not the desktop 16% — the whole strip/title
          composition above shifts up by max-sm:-translate-y-[8%], and the
          CTAs need to move up by roughly that same amount to stay the same
          visual distance below the title rather than opening a gap. */}
      <div
        className="absolute inset-x-0 z-20 flex flex-wrap items-center justify-center gap-x-10 gap-y-3 px-4 text-lg text-paper max-sm:bottom-[24%] sm:gap-x-16 sm:bottom-[16%] sm:text-xl"
      >
        {/* GlowButton routes internal hrefs through <Link> and opens external
            ones in a new tab on its own — no target/rel needed here. */}
        {heroButtons.map((btn) => (
          <GlowButton key={btn.key} href={btn.href}>
            <RollingText>{btn.label}</RollingText>
          </GlowButton>
        ))}
      </div>
    </section>
  );
}
