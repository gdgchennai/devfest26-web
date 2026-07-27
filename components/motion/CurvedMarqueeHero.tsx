"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import * as THREE from "three";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { archivePhotos } from "@/lib/content";
import { siteConfig } from "@/site.config";
import { prefersReducedMotion } from "@/lib/motion-prefs";
import { RollingText } from "@/components/motion/RollingText";

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
  const ticketHref = siteConfig.ticketing.url ?? "/agenda";

  useEffect(() => {
    if (!containerRef.current) return;
    const view: HTMLDivElement = containerRef.current;
    const reduce = prefersReducedMotion();

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, view.clientWidth / view.clientHeight, 0.1, 20);
    camera.position.z = 2;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(view.clientWidth, view.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    view.appendChild(renderer.domElement);

    const geometry = new THREE.PlaneGeometry(1, 1, 20, 20);
    const loader = new THREE.TextureLoader();
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
          // Deliberately NOT setting texture.colorSpace: this custom
          // ShaderMaterial outputs texture samples straight to the canvas with
          // no sRGB re-encode, so decoding the texture to linear (which
          // colorSpace=SRGB does) would render the photos dark/low-contrast.
          // Leaving it as-is passes the sRGB bytes through, matching the source.
          const img = texture.image as { width: number; height: number };
          const material = new THREE.ShaderMaterial({
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
          const mesh = new THREE.Mesh(geometry, material);
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

    return () => {
      cancelAnimationFrame(raf);
      trigger?.kill();
      window.removeEventListener("resize", onResize);
      disposePlanes();
      geometry.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === view) view.removeChild(renderer.domElement);
    };
  }, []);

  // ---- The title as real extruded 3D text (its own WebGL layer, above the
  // slider) so it reads as a solid object popping off the background. ----
  useEffect(() => {
    if (!textRef.current) return;
    const host: HTMLDivElement = textRef.current;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, host.clientWidth / host.clientHeight, 0.1, 100);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    host.appendChild(renderer.domElement);

    // Lights shape the bevels — that shading is what sells "solid 3D".
    scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const key = new THREE.DirectionalLight(0xffffff, 3);
    key.position.set(-3, 4, 6);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.9);
    fill.position.set(4, -1, 3);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0x5b8cff, 1.1); // brand-blue edge glow
    rim.position.set(0, 2, -5);
    scene.add(rim);

    let mesh: THREE.Mesh | null = null;
    let geometry: TextGeometry | null = null;
    let material: THREE.Material | null = null;
    let disposed = false;

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
      geometry = new TextGeometry(siteConfig.shortName, {
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
      material = new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.38, metalness: 0.12 });
      mesh = new THREE.Mesh(geometry, material);
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

    return () => {
      disposed = true;
      window.removeEventListener("resize", onResize);
      geometry?.dispose();
      material?.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
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
      <h1 className="sr-only">{siteConfig.shortName}</h1>

      {/* Calls to action. */}
      <div
        className="absolute inset-x-0 z-20 flex items-center justify-center gap-10 text-lg text-paper sm:gap-16 sm:text-xl"
        style={{ bottom: "16%" }}
      >
        <Link href={ticketHref}>
          <RollingText>Get Tickets →</RollingText>
        </Link>
        <Link href="/agenda">
          <RollingText>See Agenda →</RollingText>
        </Link>
      </div>
    </section>
  );
}
