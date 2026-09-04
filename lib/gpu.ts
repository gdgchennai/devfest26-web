import { isLowPowerDevice } from "@/lib/motion-prefs";

/**
 * Software rasterizers still report "WebGL works". Driving the intro, hallway
 * and three.js scenes through them is worse than CPU compositing: the work
 * stays on the CPU and fights the rest of the page. Match the strings browsers
 * actually expose via WEBGL_debug_renderer_info.
 */
const SOFTWARE_GPU =
  /swiftshader|llvmpipe|virtualbox|microsoft basic render|softpipe|gdi generic|apple software|mesa offscreen/i;

let cached: boolean | undefined;

/**
 * True when a hardware GPU is actually compositing WebGL — not SwiftShader,
 * WARP, or another software fallback. Probed once per page load (creating a
 * context is not free) and safe to call from effects; returns false during SSR.
 */
export function hasHardwareGpu(): boolean {
  if (typeof window === "undefined") return false;
  if (cached !== undefined) return cached;
  cached = probe();
  return cached;
}

function probe(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const attrs: WebGLContextAttributes = {
      powerPreference: "high-performance",
      failIfMajorPerformanceCaveat: true,
      stencil: false,
      depth: false,
    };
    const gl =
      (canvas.getContext("webgl2", attrs) as WebGLRenderingContext | null) ||
      (canvas.getContext("webgl", attrs) as WebGLRenderingContext | null);
    if (!gl) return false;
    const debug = gl.getExtension("WEBGL_debug_renderer_info");
    if (debug) {
      const renderer = gl.getParameter(debug.UNMASKED_RENDERER_WEBGL);
      if (typeof renderer === "string" && SOFTWARE_GPU.test(renderer)) {
        gl.getExtension("WEBGL_lose_context")?.loseContext();
        return false;
      }
    }
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export type GpuQuality = {
  /** Hardware GPU is driving WebGL. */
  hardware: boolean;
  pixelRatio: number;
  antialias: boolean;
  /** Device-pixel scale for 2D canvases (ParticleCover, etc.). */
  canvasDpr: number;
};

/**
 * Quality knobs for GPU-backed work. Hardware GPU + a capable device gets
 * antialias and 2× pixel ratio; software GL or a low-power box stays at 1×
 * with no AA so we do not spend CPU pretending to be a GPU.
 */
export function gpuQuality(): GpuQuality {
  const hardware = hasHardwareGpu();
  const lowPower = isLowPowerDevice();
  if (!hardware || lowPower) {
    return { hardware, pixelRatio: 1, antialias: false, canvasDpr: 1 };
  }
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  return { hardware, pixelRatio: dpr, antialias: true, canvasDpr: dpr };
}
