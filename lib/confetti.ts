"use client";

import { shouldUseStaticBaseline } from "@/lib/motion-prefs";

type ConfettiParticle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  shape: "rect" | "circle";
  opacity: number;
  tilt: number;
  tiltSpeed: number;
};

const BRAND_COLORS = [
  "#4285F4", // Google Blue
  "#EA4335", // Google Red
  "#FBBC05", // Google Yellow
  "#34A853", // Google Green
  "#A142F4", // DevFest Purple
  "#FFFFFF", // Crisp White
];

/**
 * Bursts festive confetti particles upward from the bottom of the screen,
 * cascading down with gravity and air resistance.
 */
export function burstConfetti(particleCount = 130): () => void {
  if (typeof window === "undefined") return () => {};
  if (shouldUseStaticBaseline()) return () => {};

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};

  canvas.style.position = "fixed";
  canvas.style.inset = "0";
  canvas.style.width = "100vw";
  canvas.style.height = "100vh";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "9999";
  document.body.appendChild(canvas);

  let width = (canvas.width = window.innerWidth);
  let height = (canvas.height = window.innerHeight);

  function onResize() {
    if (!canvas) return;
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  }
  window.addEventListener("resize", onResize);

  const particles: ConfettiParticle[] = [];

  // Spawn two overlapping fountains from bottom left-center and bottom right-center
  for (let i = 0; i < particleCount; i++) {
    const fromLeft = i % 2 === 0;
    const originX = fromLeft
      ? width * 0.25 + (Math.random() - 0.5) * 80
      : width * 0.75 + (Math.random() - 0.5) * 80;
    const originY = height + 10;

    // Angle towards the center and upward
    const baseAngle = fromLeft ? -Math.PI / 2.6 : -Math.PI / 1.6;
    const angle = baseAngle + (Math.random() - 0.5) * 0.65;
    const speed = 15 + Math.random() * 14;

    particles.push({
      x: originX,
      y: originY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 6 + Math.random() * 6,
      color: BRAND_COLORS[Math.floor(Math.random() * BRAND_COLORS.length)],
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 12,
      shape: Math.random() > 0.35 ? "rect" : "circle",
      opacity: 1,
      tilt: Math.random() * 10,
      tiltSpeed: 0.1 + Math.random() * 0.2,
    });
  }

  let animationFrameId: number;
  let active = true;

  function render() {
    if (!active || !ctx) return;
    ctx.clearRect(0, 0, width, height);

    let aliveCount = 0;

    for (const p of particles) {
      // Physics: gravity + air friction
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.45; // Gravity
      p.vx *= 0.99; // Air drag
      p.rotation += p.rotationSpeed;
      p.tilt += p.tiltSpeed;

      // Start fading when descending near the bottom
      if (p.y > height * 0.65) {
        p.opacity -= 0.012;
      }

      if (p.opacity > 0 && p.y < height + 50) {
        aliveCount++;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.fillStyle = p.color;

        if (p.shape === "circle") {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Rectangular confetti with 3D fluttering tilt
          const xTilt = Math.sin(p.tilt) * (p.size * 0.8);
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size + xTilt, p.size * 1.6);
        }
        ctx.restore();
      }
    }

    if (aliveCount > 0) {
      animationFrameId = requestAnimationFrame(render);
    } else {
      cleanup();
    }
  }

  function cleanup() {
    active = false;
    cancelAnimationFrame(animationFrameId);
    window.removeEventListener("resize", onResize);
    if (canvas && canvas.parentNode) {
      canvas.parentNode.removeChild(canvas);
    }
  }

  animationFrameId = requestAnimationFrame(render);

  // Safety timeout to ensure canvas is removed after 5 seconds
  const timeoutId = window.setTimeout(cleanup, 5000);

  return () => {
    window.clearTimeout(timeoutId);
    cleanup();
  };
}
