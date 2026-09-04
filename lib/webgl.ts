import type { WebGLRenderer } from "three";
import { gpuQuality, hasHardwareGpu } from "@/lib/gpu";

type RendererCtor = new (params?: {
  alpha?: boolean;
  antialias?: boolean;
  powerPreference?: WebGLPowerPreference;
  stencil?: boolean;
  depth?: boolean;
  premultipliedAlpha?: boolean;
  preserveDrawingBuffer?: boolean;
  failIfMajorPerformanceCaveat?: boolean;
}) => WebGLRenderer;

/**
 * Shared WebGLRenderer setup for dynamically-imported three.js scenes.
 * Asks for the discrete/high-performance GPU when the probe in lib/gpu.ts
 * says one is actually there; otherwise low-power so a software fallback
 * does not fight the CPU compositor.
 */
export function createAlphaRenderer(
  WebGLRenderer: RendererCtor,
  host: HTMLElement,
  opts?: { pixelRatio?: number; antialias?: boolean },
): WebGLRenderer {
  const quality = gpuQuality();
  const gpu = hasHardwareGpu();
  const renderer = new WebGLRenderer({
    alpha: true,
    antialias: opts?.antialias ?? quality.antialias,
    powerPreference: gpu ? "high-performance" : "low-power",
    stencil: false,
    depth: true,
    premultipliedAlpha: true,
    preserveDrawingBuffer: false,
  });
  renderer.setPixelRatio(opts?.pixelRatio ?? quality.pixelRatio);
  renderer.setSize(host.clientWidth, host.clientHeight);
  renderer.setClearColor(0x000000, 0);
  host.appendChild(renderer.domElement);
  return renderer;
}
